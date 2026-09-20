import { judgeOutputSchema } from "../schemas/judge.ts";
import {
  reflectContextSchema,
  reflectOutputSchema,
} from "../schemas/reflect.ts";
import { REFLECT_SYSTEM, buildReflectUser } from "../prompts/prompt-reflect.ts";

/** 세부로 연달아 내려갈 수 있는 횟수. 이 값에 닿으면 다음은 중심 질문으로 돌아온다.
 *  RULES 8.3과 Prompt D 4.6이 같은 수를 본다. */
export const REFLECT_DETAIL_LIMIT = 2;

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
  const pastAllowed =
    context.past_probe_count === 0 && context.last_question_type !== "PAST";
  // 세부로 내려간 질문이 연달아 한계에 닿으면 다음 질문은 중심으로 돌아온다.
  // 모델이 자기 과거 질문을 세게 하지 않는다. 저장된 라벨을 코드가 센다.
  const mustReturnToCenter = context.detail_streak >= REFLECT_DETAIL_LIMIT;
  const input = {
    ...context,
    must_return_to_center: mustReturnToCenter,
    shift_confidence: judge.shift_confidence as "MEDIUM" | "LOW",
    evidence_turns: judge.evidence_turns,
    medium_reason: judge.medium_reason,
    past_allowed: pastAllowed,
  };
  return {
    system: REFLECT_SYSTEM,
    user: buildReflectUser(input),
    // Bind validation to the same context used for generation.
    validateOutput(raw: unknown) {
      const out = reflectOutputSchema.parse(raw);
      if (out.type === "PAST" && !pastAllowed)
        throw new Error("PAST_NOT_ALLOWED");
      return out;
    },
  };
}

/** Deterministic diagnostics only; no semantic quality/pass judgement. */
export function inspectReflectionQuestion(question: string): string[] {
  const flags: string[] = [];
  if ((question.match(/[?？]/gu) ?? []).length > 1)
    flags.push("MULTIPLE_QUESTION_MARKS");
  if (/것\s*같아요\s*[?？]?\s*$/u.test(question))
    flags.push("HEDGE_INDUCING_ENDING");
  if (/군요[.!。]?\s*$/u.test(question)) flags.push("STATEMENT_ENDING");
  return flags;
}
