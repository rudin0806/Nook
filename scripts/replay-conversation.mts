/**
 * 보고된 대화를 그대로 재연한다.
 *
 * 사용자가 "귀찮아지고 대화를 멈추고 싶었다"고 말한 흐름을 턴 단위로 다시 태워,
 * D-01(§4.5 같은 질문 금지 · §4.6 세부의 바닥 · stalled)이 실제 모델에서 듣는지 본다.
 * 고정 케이스라 회귀 확인에 계속 쓸 수 있고, 호출 수는 상한으로 묶여 있다.
 *
 * 모델·effort는 운영과 같은 환경변수(`NOOK_JUDGE_*`, `NOOK_REFLECT_*`)로 넘긴다.
 * 넘기지 않으면 현재 운영값을 기본으로 쓴다. 프록시 뒤에서 돌릴 때는 Node의 fetch가
 * `HTTPS_PROXY`를 스스로 읽지 않으므로 `NODE_USE_ENV_PROXY=1`이 함께 필요하다.
 */
import OpenAI from "openai";
import { prepareJudge } from "../src/engine/judge.ts";
import { executeJson } from "../src/engine/json-model.ts";
import { executeReflection } from "../src/engine/reflect-runtime.ts";
import { inspectReflectionQuestion } from "../src/engine/reflect.ts";
import { isStalled } from "../src/engine/stall.ts";
import { isConfused } from "../src/engine/confusion.ts";

/** 보고된 대화들. 사용자 발화만 고정하고 AI 발화는 재연이 직접 만든다.
 *  `observed`는 그때 실제로 나왔던 질문이고 비교용으로만 쓴다 — 입력에 넣지 않는다. */
const CASES = {
  lizard: {
    question: "도마뱀을 키울까?",
    users: [
      "나 도마뱀 키우고 싶은데 고민돼 근데 끝까지 책임질 수 있을지 무서워",
      "처음엔 흥미로워서 잘 키울 수 있지만, 나중에는 질릴 수 있잖아",
      "주기적인 돌봄들",
      "그런건 알아서 뭐하게",
    ],
    observed: [
      "어떤 상황을 떠올릴 때 그런 생각이 들어요?",
      "끝까지 할 수 있을지 모르겠는 일은 뭐예요?",
      "구체적으로 어떤 일이에요?",
    ],
  },
  // 2026-09-20 보고. 사용자 말을 통째로 주어 자리에 끼워 넣어 한국어가 깨졌고,
  // "무슨말인지 모르겠어"에 같은 틀의 질문이 한 번 더 갔다.
  company: {
    question: "나는 회사를 잘 다닐 수 있을까?",
    users: [
      "내가 회사를 잘 다닐 수 있을까?",
      "내가 성장할 수 있을지 모르겟어",
      "지금 회사는 사수도 없고 배우는 게 없거든",
      "사수가 생겨야겠지?",
      "무슨말인지 모르겠어",
      "회사에서 업무에 대한 지식을 배우고 싶어",
    ],
    observed: [
      "회사를 잘 다닐 수 있을지 생각할 때, 지금 가장 걸리는 장면은 뭐예요?",
      "성장할 수 있을지 모르겠다는 생각이 들 때, 회사에서 어떤 점이 가장 걸려요?",
      "사수도 없고 배우는 게 없는 지금 회사에서, 회사를 잘 다니려면 무엇이 달라져야 해요?",
      "사수가 생겨야겠지 싶다는 지금 회사에서, 사수가 생기기 전까지 회사를 잘 다닌다고 볼 수 있는 모습은 어떤 건가요?",
      "사수가 생겨야겠지 싶다면, 사수가 생기면 회사에서 무엇을 배우고 싶어요?",
      "업무에 대한 지식을 배우고 싶다는 점이, 회사를 잘 다닐 수 있을지와는 어떻게 이어져요?",
    ],
  },
  // 2026-09-20 보고. 중심 질문에서 성취 → 배울 점 → 책임감 있는 업무로 세 번
  // 내려가며 질문이 멀어졌다. 사용자는 세 번째를 보고 "이 질문을 왜 하지?"라고 했다.
  drift: {
    question: "나는 회사를 잘 다닐 수 있을까?",
    users: [
      "내가 회사를 잘 다닐 수 있을까?",
      "회사얘기 좀 더 해보자",
      "지금 회사는 안정적이라, 일도 적고 편하게 일하기 좋아",
      "성취, 같이 일하는 사람들이 열정적으로 일하는 것",
      "거기서 배우는 점이 생기겠지?",
      "책임감 있는 업무",
    ],
    observed: [
      "회사를 잘 다닐 수 있을지 생각할 때, 지금 가장 걸리는 장면은 뭐예요?",
      "업무 지식을 배우는 것 말고도 지금 회사를 계속 다니게 할 이유가 뭐예요?",
      "지금처럼 안정적이고 일이 적은 환경이 이어져도 회사를 잘 다니고 있다고 느끼려면 무엇이 있어야 해요?",
      "지금 회사에서 성취를 얻고 같이 일하는 사람들이 열정적으로 일한다면, 배우는 것이 없다는 점은 어떻게 달라져요?",
      "지금 회사에서 배우는 점이 생겼다고 보려면 어떤 업무를 맡고 있어야 해요?  ← 사용자가 지적한 질문",
      "지금 회사에서 책임감 있는 업무를 맡을 기회가 있는지는 무엇을 보면 알 수 있어요?",
    ],
  },
  // 2026-09-20 보고. 힘들었던 장면에 사실관계를 캐물어 조사가 됐다.
  gecko: {
    question: "나 마음이 너무 힘들어",
    users: [
      "나 마음이 너무 힘들어",
      "내가 키우던 크레가 죽은 줄 알았어",
      "죽었는지 확인했지",
    ],
    observed: [
      "마음이 너무 힘들다고 느끼는 건 오늘 어떤 때예요?",
      "크레가 죽은 줄 알았을 때, 바로 무엇을 확인했어요?  ← 사실 확인",
      "죽은 줄 알았던 뒤에 크레 상태가 어떻게 달라졌어요?  ← 사실 확인",
    ],
  },
  // 아래 둘은 **프롬프트에 예시로 들어 있지 않은** 사례다. drift와 gecko는 고친
  // 규칙의 예시로 프롬프트에 그대로 적혀 있어서, 그 둘만으로는 모델이 예시를 베낀
  // 것인지 규칙을 따른 것인지 가를 수 없다. 같은 모양의 함정을 새로 만들어 둔다.
  //
  // holdout_chain: 조건 되묻기 연쇄가 열리는 자리.
  //   U3에서 `대화가 잘 통해야` → "잘 통한다고 보려면 어떤 대화를 해야 해요?"
  //   U4에서 `속마음 얘기`    → "속마음 얘기를 하는지는 무엇을 보면 알 수 있어요?"
  //   두 번 다 중심 질문은 한 칸도 움직이지 않는다.
  holdout_chain: {
    question: "이 사람이랑 계속 만나야 할까?",
    users: [
      "이 사람이랑 계속 만나야 할까?",
      "잘 맞는지 모르겠어",
      "대화가 잘 통해야 잘 맞는 거지",
      "속마음 얘기",
    ],
    observed: [
      "— (프롬프트에 없는 사례. 기대값 없음)",
      "— DETAIL로 내려가면 `~보려면 어떤`, `무엇을 보면 알 수 있어요` 꼴이 나온다",
      "— 여기서 세부로 가면 연쇄가 열린다",
      "— 세 번째 내려가기. must_return_to_center가 걸려야 하는 자리",
    ],
  },
  // holdout_emotion: 힘들었던 장면에 사실관계를 캐물 자리.
  //   U2에 대고 "응급실에서 뭐라고 하셨어요?", "지금은 어떠세요?"로 가면 조사가 된다.
  holdout_emotion: {
    question: "요즘 잠이 안 와",
    users: ["요즘 잠이 안 와", "지난주에 아빠가 쓰러지셨어", "응급실 갔었어"],
    observed: [
      "— (프롬프트에 없는 사례. 기대값 없음)",
      "— 사실을 캐물으면 `바로 뭐 하셨어요`, `무슨 일이었어요` 꼴이 나온다",
      "— `지금은 어떠세요`도 사실 확인이다",
    ],
  },
} as const;
const caseName = (process.argv.find((a) => a.startsWith("--case="))?.slice(7) ??
  "company") as keyof typeof CASES;
const chosen = CASES[caseName];
if (!chosen) throw new Error(`알 수 없는 사례: ${caseName}`);
const MAIN_QUESTION = chosen.question;
const USER_TURNS = chosen.users;
const OBSERVED = chosen.observed;

const CALL_LIMIT = 16;
const judgeOptions = {
  model: process.env.NOOK_JUDGE_MODEL ?? "gpt-5.6-sol",
  reasoningEffort: process.env.NOOK_JUDGE_REASONING_EFFORT ?? "low",
  maxOutputTokens: Number(process.env.NOOK_JUDGE_MAX_OUTPUT_TOKENS ?? 1024),
};
const reflectOptions = {
  model: process.env.NOOK_REFLECT_MODEL ?? "gpt-5.6-terra",
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
const perCall: {
  stage: string;
  ms: number;
  in: number;
  cached: number;
  out: number;
}[] = [];
let stage = "?";
const transport = async (
  request: Parameters<typeof client.responses.create>[0],
) => {
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
// commit_conversation_step이 세는 방식 그대로 따라간다. DETAIL이면 올리고
// CENTER면 0으로 돌린다.
let detailStreak = 0;

for (const [index, text] of USER_TURNS.entries()) {
  turns.push({ id: `U${++userNo}`, role: "user", text });
  const stalled = isStalled(turns);
  const confused = isConfused(turns);

  console.log(`\n${"─".repeat(72)}`);
  console.log(`턴 ${index + 1}  U${userNo}: ${text}`);
  console.log(
    `  코드 신호  stalled=${stalled} confused=${confused} detail_streak=${detailStreak}`,
  );

  // conversationContext와 같은 창을 쓴다. judgeInputSchema의 turns는 8개까지이고
  // 엔진은 `turns.slice(-8)`로 자른다. 창 밖 발화는 운영에서 carryover로 넘어가지만
  // 그 값은 모델이 만들어 DB에 남는 것이라 여기서는 비워 둔다.
  const window = turns.slice(-8);
  const judgeInput = {
    main_question: MAIN_QUESTION,
    main_path: [MAIN_QUESTION],
    pile: [],
    current_clarifications: [],
    carryover: [],
    stalled,
    confused,
    turns: window,
  };
  stage = "JUDGE";
  const prepared = prepareJudge(judgeInput, turns, judgeOptions);
  const judge = await executeJson(
    prepared.request,
    prepared.validateOutput,
    transport,
    "JUDGE",
  );
  console.log(
    `  Judge      ${judge.action}${judge.shift_confidence ? "/" + judge.shift_confidence : ""}`,
  );

  if (judge.action !== "REFLECT") {
    console.log(
      `  → 되묻지 않고 ${judge.action}. 여기서 대화가 멈출 자리를 얻는다.`,
    );
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
      confused,
      detail_streak: detailStreak,
      current_clarifications: [],
      turns: window,
      carryover: [],
    },
    reflectOptions,
    transport,
  );
  const flags = inspectReflectionQuestion(reflection.question);
  console.log(`  질문       ${reflection.question}`);
  console.log(`  (관찰됐던)  ${OBSERVED[index] ?? "—"}`);
  console.log(
    `  scope=${reflection.scope}  type=${reflection.type}${flags.length ? "  flags=" + flags.join(",") : ""}`,
  );

  detailStreak = reflection.scope === "DETAIL" ? detailStreak + 1 : 0;
  lastQuestionType = reflection.type;
  if (reflection.type === "PAST") pastProbeCount = 1;
  turns.push({
    id: `A${++assistantNo}`,
    role: "assistant",
    text: reflection.question,
  });
}

console.log(`\n${"─".repeat(72)}`);
console.log(
  `Judge ${judgeOptions.model}/${judgeOptions.reasoningEffort} · Reflect ${reflectOptions.model}/${reflectOptions.reasoningEffort}`,
);
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
