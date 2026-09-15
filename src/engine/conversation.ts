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

export function conversationContext(raw: unknown) {
  const snapshot = conversationSnapshotSchema.parse(raw);
  const turns = snapshot.messages.map((m) => ({
    id: `${m.role === "USER" ? "U" : "A"}${m.sequence_no}`,
    role: m.role === "USER" ? ("user" as const) : ("assistant" as const),
    text: m.content,
  }));
  const window = turns.slice(-8);
  const windowIds = new Set(window.map((t) => t.id));
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
