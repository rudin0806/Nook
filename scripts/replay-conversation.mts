/**
 * 보고된 대화를 그대로 재연한다.
 *
 * 사용자가 "귀찮아지고 대화를 멈추고 싶었다"고 말한 흐름을 턴 단위로 다시 태워,
 * D-01(§4.5 같은 질문 금지 · §4.6 세부의 바닥 · stalled)이 실제 모델에서 듣는지 본다.
 * 고정 케이스라 회귀 확인에 계속 쓸 수 있고, 호출 수는 상한으로 묶여 있다.
 */
import OpenAI from "openai";
import { prepareJudge } from "../src/engine/judge.ts";
import { executeJson } from "../src/engine/json-model.ts";
import { executeReflection } from "../src/engine/reflect-runtime.ts";
import { inspectReflectionQuestion } from "../src/engine/reflect.ts";
import { isStalled } from "../src/engine/stall.ts";

const MAIN_QUESTION = "도마뱀을 키울까?";
/** 보고된 사용자 발화. AI 발화는 재연이 직접 만든다. */
const USER_TURNS = [
  "나 도마뱀 키우고 싶은데 고민돼 근데 끝까지 책임질 수 있을지 무서워",
  "처음엔 흥미로워서 잘 키울 수 있지만, 나중에는 질릴 수 있잖아",
  "주기적인 돌봄들",
  "그런건 알아서 뭐하게",
];
/** 재연 당시 실제로 나왔던 질문. 비교용으로만 쓰고 입력에 넣지 않는다. */
const OBSERVED = [
  "어떤 상황을 떠올릴 때 그런 생각이 들어요?",
  "끝까지 할 수 있을지 모르겠는 일은 뭐예요?",
  "구체적으로 어떤 일이에요?",
];

const CALL_LIMIT = 10;
const judgeOptions = {
  model: process.env.NOOK_JUDGE_MODEL ?? "gpt-5.6-sol",
  reasoningEffort: process.env.NOOK_JUDGE_REASONING_EFFORT ?? "medium",
  maxOutputTokens: Number(process.env.NOOK_JUDGE_MAX_OUTPUT_TOKENS ?? 1024),
};
const reflectOptions = {
  model: process.env.NOOK_REFLECT_MODEL ?? "gpt-5.6-sol",
  reasoningEffort: process.env.NOOK_REFLECT_REASONING_EFFORT ?? "medium",
  maxOutputTokens: Number(process.env.NOOK_REFLECT_MAX_OUTPUT_TOKENS ?? 1024),
};

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? "proxy-injected",
  maxRetries: 0,
  timeout: 90_000,
});
const usage = { calls: 0, in: 0, out: 0, cached: 0, ms: 0 };
/** 호출 하나하나의 시간. 어느 단계가 사용자를 기다리게 하는지 보려고 남긴다. */
const perCall: { stage: string; ms: number; in: number; cached: number; out: number }[] = [];
let stage = "?";
const transport = async (request: Parameters<typeof client.responses.create>[0]) => {
  if (++usage.calls > CALL_LIMIT) throw new Error("CALL_LIMIT");
  const started = Date.now();
  const r = await client.responses
    .create({ ...request, stream: false })
    .catch((error: unknown) => {
      const e = error as { status?: number; code?: string; message?: string };
      console.error(
        `  [provider] status=${e?.status} code=${e?.code} ${String(e?.message).slice(0, 300)}`,
      );
      throw error;
    });
  const ms = Date.now() - started;
  const inTok = r.usage?.input_tokens ?? 0;
  const cached = r.usage?.input_tokens_details?.cached_tokens ?? 0;
  const outTok = r.usage?.output_tokens ?? 0;
  usage.in += inTok;
  usage.out += outTok;
  usage.cached += cached;
  usage.ms += ms;
  perCall.push({ stage, ms, in: inTok, cached, out: outTok });
  return {
    status: r.status,
    output_text: r.output_text,
    model: r.model,
    usage: r.usage,
  };
};

const turns: { id: string; role: "user" | "assistant"; text: string }[] = [];
let userNo = 0;
let assistantNo = 0;
let lastQuestionType: "PRESENT" | "PAST" | "COMPARE" | null = null;
let pastProbeCount: 0 | 1 = 0;

for (const [index, text] of USER_TURNS.entries()) {
  turns.push({ id: `U${++userNo}`, role: "user", text });
  const stalled = isStalled(turns);

  console.log(`\n${"─".repeat(72)}`);
  console.log(`턴 ${index + 1}  U${userNo}: ${text}`);
  console.log(`  코드 신호  stalled=${stalled}`);

  const judgeInput = {
    main_question: MAIN_QUESTION,
    main_path: [MAIN_QUESTION],
    pile: [],
    current_clarifications: [],
    carryover: [],
    stalled,
    turns,
  };
  stage = "JUDGE";
  const prepared = prepareJudge(judgeInput, turns, judgeOptions);
  const judge = await executeJson(
    prepared.request,
    prepared.validateOutput,
    transport,
    "JUDGE",
  );
  console.log(`  Judge      ${judge.action}${judge.shift_confidence ? "/" + judge.shift_confidence : ""}`);

  if (judge.action !== "REFLECT") {
    console.log(`  → 되묻지 않고 ${judge.action}. 여기서 대화가 멈출 자리를 얻는다.`);
    break;
  }

  stage = "REFLECT";
  const reflection = await executeReflection(
    judge,
    {
      main_question: MAIN_QUESTION,
      past_probe_count: pastProbeCount,
      last_question_type: lastQuestionType,
      last_question:
        [...turns].reverse().find((t) => t.role === "assistant")?.text ?? null,
      stalled,
      current_clarifications: [],
      turns,
      carryover: [],
    },
    reflectOptions,
    transport,
  );
  const flags = inspectReflectionQuestion(reflection.question);
  console.log(`  질문       ${reflection.question}`);
  console.log(`  (관찰됐던)  ${OBSERVED[index] ?? "—"}`);
  console.log(`  type=${reflection.type}${flags.length ? "  flags=" + flags.join(",") : ""}`);

  lastQuestionType = reflection.type;
  if (reflection.type === "PAST") pastProbeCount = 1;
  turns.push({ id: `A${++assistantNo}`, role: "assistant", text: reflection.question });
}

console.log(`\n${"─".repeat(72)}`);
console.log(`Judge ${judgeOptions.model}/${judgeOptions.reasoningEffort} · Reflect ${reflectOptions.model}/${reflectOptions.reasoningEffort}`);
for (const [i, c] of perCall.entries())
  console.log(
    `  ${String(i + 1).padStart(2)} ${c.stage.padEnd(8)} ${String(c.ms).padStart(6)}ms  입력 ${String(c.in).padStart(5)}(캐시 ${String(c.cached).padStart(5)})  출력 ${String(c.out).padStart(4)}`,
  );
const byStage = (name: string) => perCall.filter((c) => c.stage === name);
for (const name of ["JUDGE", "REFLECT"]) {
  const rows = byStage(name);
  if (!rows.length) continue;
  const avg = Math.round(rows.reduce((a, c) => a + c.ms, 0) / rows.length);
  console.log(`  ${name} 평균 ${avg}ms (${rows.length}회)`);
}
const turnsShown = Math.max(1, USER_TURNS.length);
console.log(
  `호출 ${usage.calls}회 · 입력 ${usage.in.toLocaleString()}토큰(캐시 ${usage.cached.toLocaleString()}, ${Math.round((usage.cached / Math.max(1, usage.in)) * 100)}%) · 출력 ${usage.out.toLocaleString()}토큰`,
);
console.log(
  `모델 대기 합계 ${usage.ms.toLocaleString()}ms · 사용자가 한 턴에 기다리는 시간 약 ${Math.round(usage.ms / turnsShown).toLocaleString()}ms`,
);
