import { judgeOutputSchema } from "../schemas/judge.ts";
import {
  reflectContextSchema,
  reflectOutputSchema,
} from "../schemas/reflect.ts";
import { REFLECT_SYSTEM, buildReflectUser } from "../prompts/prompt-reflect.ts";

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
  const input = {
    ...context,
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
