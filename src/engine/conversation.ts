import { prepareJudge, type PrepareJudgeOptions } from "./judge.ts";
import { executeReframe } from "./reframe.ts";
import { executeReflection } from "./reflect-runtime.ts";
import { executeJson, type JsonTransport } from "./json-model.ts";
import {
  conversationSnapshotSchema,
  conversationPlanSchema,
  type ConversationSnapshot,
} from "../schemas/conversation.ts";
import { judgeInputSchema } from "../schemas/judge.ts";
import { isStalled } from "./stall.ts";
import { isConfused } from "./confusion.ts";
import { isNonAnswer } from "./non-answer.ts";
import { hasExplicitCorrection } from "./correction.ts";

export function conversationContext(raw: unknown) {
  const snapshot = conversationSnapshotSchema.parse(raw);
  const turns = snapshot.messages.map((m) => ({
    id: `${m.role === "USER" ? "U" : "A"}${m.sequence_no}`,
    role: m.role === "USER" ? ("user" as const) : ("assistant" as const),
    text: m.content,
  }));
  const window = turns.slice(-8);
  const windowIds = new Set(window.map((t) => t.id));
  // 세션 턴에서 한 번만 센 뒤 Judge와 Reflection이 같은 코드 신호를 쓴다.
  const correctedPreviousFrame = hasExplicitCorrection(turns);
  const input = judgeInputSchema.parse({
    dismissed_closure: snapshot.state.dismissed_closure,
    main_question: snapshot.current.final_text,
    main_path: snapshot.path.map((n) => n.final_text),
    pile: snapshot.pile.map((p) => ({ id: p.id, text: p.text })),
    current_clarifications: snapshot.clarifications
      .filter((c) => c.node_id === snapshot.current.id)
      .slice(-16)
      .map((c) => ({ id: c.id, text: c.text })),
    carryover: snapshot.state.carryover.filter((c) => !windowIds.has(c.turn)),
    // 창이 아니라 세션 전체를 본다. 기준선이 될 앞선 발화가 창 밖에 있을 수 있다.
    stalled: isStalled(turns),
    // 마지막 발화 하나만 본다. 이 신호는 바로 그 턴의 질문에 대한 반응이다.
    confused: isConfused(turns),
    // 같은 자리에서, 글자의 종류만 본다.
    non_answer: isNonAnswer(turns),
    corrected_previous_frame: correctedPreviousFrame,
    turns: window,
  });
  const turnIds = Object.fromEntries(
    snapshot.messages
      .filter((m) => m.role === "USER")
      .map((m) => [`U${m.sequence_no}`, m.id]),
  );
  return { snapshot, turns, input, turnIds };
}
export function explicitFinish(text: string) {
  return /^(그만할래|그만할게|여기까지 할게|여기까지 할래|대화 그만|대화를 그만할래|대화를 종료할게|그만)[.!。\s]*$/u.test(
    text.trim(),
  );
}
export function structuralLimit(s: ConversationSnapshot) {
  return s.segment.node_count >= 4 || s.segment.turn_count >= 20;
}
export async function planConversationTurn(
  raw: unknown,
  options: {
    judge: PrepareJudgeOptions;
    reframe: PrepareJudgeOptions;
    reflect: PrepareJudgeOptions;
  },
  transport: JsonTransport,
) {
  const { snapshot, turns, input, turnIds } = conversationContext(raw);
  const base = {
    judge: null,
    metadata: null,
    turnIds,
    carryover: snapshot.state.carryover,
    evidence_ids: [],
    promoted_branch_id: null,
    one_turn_shift: false,
  };
  if (explicitFinish(turns.at(-1)!.text))
    return conversationPlanSchema.parse({ ...base, kind: "FINISH" });
  if (structuralLimit(snapshot))
    return conversationPlanSchema.parse({ ...base, kind: "STRUCTURAL" });
  const prepared = prepareJudge(input, turns, options.judge);
  const started = Date.now();
  let usage: { input_tokens?: number; output_tokens?: number } | undefined;
  const judge = await executeJson(
    prepared.request,
    prepared.validateOutput,
    async (request) => {
      const response = await transport(request);
      usage = response.usage;
      return response;
    },
    "JUDGE",
  );
  const metadata = {
    configuredModel: prepared.request.model,
    promptVersion: prepared.promptVersion,
    latencyMs: Date.now() - started,
    inputTokens: usage?.input_tokens ?? null,
    outputTokens: usage?.output_tokens ?? null,
  };
  const newCarry =
    judge.action === "REFLECT" && judge.shift_confidence === "MEDIUM"
      ? judge.evidence_turns.map((id) => ({
          turn: id,
          text: turns.find((t) => t.id === id)!.text,
          judged: "MEDIUM" as const,
          medium_reason: judge.medium_reason!,
        }))
      : [];
  const carryover = [
    ...snapshot.state.carryover.filter(
      (c) => !newCarry.some((n) => n.turn === c.turn),
    ),
    ...newCarry,
  ].slice(-2);
  const common = { ...base, judge, metadata, carryover };
  if (judge.action === "CLOSE")
    return conversationPlanSchema.parse({ ...common, kind: "CLOSE" });
  if (judge.action === "SHIFT") {
    const generated = await executeReframe(
      judge,
      input,
      turns,
      options.reframe,
      transport,
    );
    return conversationPlanSchema.parse({
      ...common,
      kind: "SHIFT",
      ...generated.output,
      evidence_ids: judge.evidence_turns.map((id) => turnIds[id]),
      promoted_branch_id: judge.promote_pile_item,
      one_turn_shift: judge.evidence_turns.length === 1,
    });
  }
  const reflection = await executeReflection(
    judge,
    {
      main_question: input.main_question,
      past_probe_count: snapshot.session.past_probe_count,
      last_question_type: snapshot.state.last_question_type,
      current_clarifications: input.current_clarifications.map((c) => ({
        id: c.id,
        text: c.text,
      })),
      last_question:
        [...turns].reverse().find((t) => t.role === "assistant")?.text ?? null,
      stalled: input.stalled ?? false,
      confused: input.confused ?? false,
      non_answer: input.non_answer ?? false,
      corrected_previous_frame: input.corrected_previous_frame,
      detail_streak: snapshot.state.detail_streak,
      turns: input.turns,
      carryover: input.carryover.map((c) => ({ turn: c.turn, text: c.text })),
    },
    options.reflect,
    transport,
  );
  return conversationPlanSchema.parse({
    ...common,
    kind: "REFLECT",
    ...reflection,
  });
}
