import { judgeOutputSchema } from "../schemas/judge.ts";
import {
  reflectContextSchema,
  reflectOutputSchema,
  type ReflectMode,
} from "../schemas/reflect.ts";
import { REFLECT_SYSTEM, buildReflectUser } from "../prompts/prompt-reflect.ts";
import { replyLength } from "./stall.ts";

/** 세부로 연달아 내려갈 수 있는 횟수. 이 값에 닿으면 다음은 중심 질문으로 돌아온다.
 *  RULES 5.4.6과 Prompt D가 같은 수를 본다. */
export const REFLECT_DETAIL_LIMIT = 2;

type ReflectionModeSignals = {
  corrected_previous_frame: boolean;
  confused: boolean;
  non_answer: boolean;
  stalled: boolean;
  detail_streak: number;
  shift_confidence: "MEDIUM" | "LOW";
};

/** 먼저 일어난 복구 신호 하나만 Prompt D에 전달한다. */
export function selectReflectionMode(
  signals: ReflectionModeSignals,
): ReflectMode {
  if (signals.corrected_previous_frame) return "CORRECTION";
  if (signals.confused) return "CONFUSED";
  if (signals.non_answer) return "NON_ANSWER";
  if (signals.stalled || signals.detail_streak >= REFLECT_DETAIL_LIMIT)
    return "RETURN_CENTER";
  if (signals.shift_confidence === "MEDIUM") return "MEDIUM";
  return "DEFAULT";
}

const FORCED_CENTER_MODES = new Set<ReflectMode>([
  "CORRECTION",
  "CONFUSED",
  "NON_ANSWER",
  "RETURN_CENTER",
]);

export class ReflectionCenterRequiredError extends Error {
  readonly code = "REFLECT_CENTER_REQUIRED";

  constructor() {
    super("REFLECT_CENTER_REQUIRED");
    this.name = "ReflectionCenterRequiredError";
  }
}

// Pure adapter only. The caller must first pass Safety, explicit-control and
// structural gates. This module does not call a model or mutate DB counters.
export function prepareReflection(rawJudge: unknown, rawContext: unknown) {
  const judge = judgeOutputSchema.parse(rawJudge);
  if (judge.action !== "REFLECT") throw new Error("REFLECT_REQUIRED");
  const context = reflectContextSchema.parse(rawContext);
  const ids = [
    ...context.turns.map((t) => t.id),
    ...context.carryover.map((t) => t.turn),
  ];
  if (new Set(ids).size !== ids.length) throw new Error("DUPLICATE_TURN_ID");
  if (context.turns.at(-1)?.role !== "user")
    throw new Error("USER_TURN_REQUIRED");
  const users = new Set([
    ...context.turns.filter((t) => t.role === "user").map((t) => t.id),
    ...context.carryover.map((t) => t.turn),
  ]);
  if (judge.evidence_turns.some((id) => !users.has(id)))
    throw new Error("EVIDENCE_UNAVAILABLE");
  const sourceTextByTurn = new Map([
    ...context.turns
      .filter((turn) => turn.role === "user")
      .map((turn) => [turn.id, turn.text] as const),
    ...context.carryover.map((turn) => [turn.turn, turn.text] as const),
  ]);
  const pastAllowed =
    context.past_probe_count === 0 && context.last_question_type !== "PAST";
  const mode = selectReflectionMode({
    ...context,
    shift_confidence: judge.shift_confidence as "MEDIUM" | "LOW",
  });
  const mustReturnToCenter = FORCED_CENTER_MODES.has(mode);
  const input = {
    ...context,
    mode,
    must_return_to_center: mustReturnToCenter,
    shift_confidence: judge.shift_confidence as "MEDIUM" | "LOW",
    evidence_turns: judge.evidence_turns,
    medium_reason: judge.medium_reason,
    past_allowed: pastAllowed,
  };
  return {
    system: REFLECT_SYSTEM,
    user: buildReflectUser(input),
    mode,
    mustReturnToCenter,
    lastQuestion: context.last_question,
    // Bind validation to the same context used for generation.
    validateOutput(raw: unknown) {
      const out = reflectOutputSchema.parse(raw);
      if (out.type === "PAST" && !pastAllowed)
        throw new Error("PAST_NOT_ALLOWED");
      if (mustReturnToCenter && out.scope !== "CENTER")
        throw new ReflectionCenterRequiredError();
      if (mustReturnToCenter && out.move !== "RECOVERY")
        throw new Error("REFLECT_RECOVERY_MOVE_REQUIRED");

      if (out.source_turn === null) {
        if (!FORCED_CENTER_MODES.has(mode))
          throw new Error("REFLECT_SOURCE_REQUIRED");
        return out;
      }

      const sourceText = sourceTextByTurn.get(out.source_turn);
      if (sourceText === undefined)
        throw new Error("REFLECT_SOURCE_UNAVAILABLE");
      if (
        !sourceText
          .normalize("NFC")
          .includes(out.source_quote!.normalize("NFC"))
      )
        throw new Error("REFLECT_SOURCE_QUOTE_MISMATCH");
      return out;
    },
  };
}

/** 공백을 뺀 이 길이를 넘으면 한 번에 읽히지 않는다(Prompt D 공통 계약). 운영에서 길다고
 *  지적받은 질문은 39~49자였고, 같은 뜻의 짧은 질문은 15~20자로 쓸 수 있었다. */
export const REFLECT_QUESTION_LONG = 40;
/** 사용자의 고민이 아니라 고민을 분석하는 쪽을 보는 말투(Prompt D 공통 계약). */
const ANALYTIC_PHRASING =
  /에\s*어떻게\s*작용|에\s*대한\s*생각은|쪽으로\s*(남는|기울)|고\s*보려면|어떤\s*의미(예요|인가요)/u;

/** Deterministic diagnostics only; no semantic quality/pass judgement. */
export function inspectReflectionQuestion(question: string): string[] {
  const flags: string[] = [];
  if ((question.match(/[?？]/gu) ?? []).length > 1)
    flags.push("MULTIPLE_QUESTION_MARKS");
  if (/것\s*같아요\s*[?？]?\s*$/u.test(question))
    flags.push("HEDGE_INDUCING_ENDING");
  if (/군요[.!。]?\s*$/u.test(question)) flags.push("STATEMENT_ENDING");
  if (replyLength(question) > REFLECT_QUESTION_LONG)
    flags.push("LONG_QUESTION");
  if (ANALYTIC_PHRASING.test(question)) flags.push("ANALYTIC_PHRASING");
  return flags;
}
