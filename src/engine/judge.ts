import { computeHedge } from "./hedge.ts";
import { JUDGE_SYSTEM, buildJudgeUser } from "../prompts/prompt-judge.ts";
import {
  judgeInputSchema,
  judgeOutputSchema,
  judgeTurnSchema,
  type JudgeOutput,
} from "../schemas/judge.ts";
import {
  requireNookModelId,
  requireNookReasoningEffort,
  type NookModelId,
  type NookReasoningEffort,
} from "../lib/openai/models.ts";
import { z } from "zod";

export const JUDGE_PROMPT_VERSION = "judge-v4.4-2026-09-16";
export const JUDGE_DEFAULT_MAX_OUTPUT_TOKENS = 2_048;
export const JUDGE_MAX_USER_PROMPT_CHARS = 20_000;

const sessionTurnsSchema = z.array(judgeTurnSchema).min(1).max(200);

export type JudgeModelRequest = {
  model: NookModelId;
  instructions: string;
  input: [
    {
      role: "user";
      content: [{ type: "input_text"; text: string }];
    },
  ];
  max_output_tokens: number;
  reasoning: { effort: NookReasoningEffort };
  store: false;
  text: { format: { type: "json_object" } };
};

export type PrepareJudgeOptions = {
  model: string;
  reasoningEffort: string;
  maxOutputTokens?: number;
};

function fail(code: string): never {
  throw new Error(code);
}

export function prepareJudge(
  rawInput: unknown,
  rawSessionTurns: unknown,
  options: PrepareJudgeOptions,
) {
  const inputResult = judgeInputSchema.safeParse(rawInput);
  if (!inputResult.success) fail("JUDGE_INPUT_INVALID");
  const sessionResult = sessionTurnsSchema.safeParse(rawSessionTurns);
  if (!sessionResult.success) fail("JUDGE_SESSION_TURNS_INVALID");

  const input = inputResult.data;
  const sessionTurns = sessionResult.data;
  if (new Set(sessionTurns.map((turn) => turn.id)).size !== sessionTurns.length)
    fail("JUDGE_SESSION_TURNS_INVALID");

  const windowStart = sessionTurns.length - input.turns.length;
  if (windowStart < 0) fail("JUDGE_CONTEXT_MISMATCH");
  for (const [index, turn] of input.turns.entries()) {
    const sessionTurn = sessionTurns[windowStart + index];
    if (
      !sessionTurn ||
      sessionTurn.id !== turn.id ||
      sessionTurn.role !== turn.role ||
      sessionTurn.text !== turn.text
    )
      fail("JUDGE_CONTEXT_MISMATCH");
  }

  const sessionById = new Map(sessionTurns.map((turn) => [turn.id, turn]));
  const windowIds = new Set(input.turns.map((turn) => turn.id));
  for (const carryover of input.carryover) {
    const sourceTurn = sessionById.get(carryover.turn);
    if (
      !sourceTurn ||
      sourceTurn.role !== "user" ||
      sourceTurn.text !== carryover.text ||
      windowIds.has(carryover.turn)
    )
      fail("JUDGE_CARRYOVER_MISMATCH");
  }

  const model = requireNookModelId(options.model);
  const reasoningEffort = requireNookReasoningEffort(options.reasoningEffort);
  const maxOutputTokens =
    options.maxOutputTokens ?? JUDGE_DEFAULT_MAX_OUTPUT_TOKENS;
  if (
    !Number.isInteger(maxOutputTokens) ||
    maxOutputTokens < 256 ||
    maxOutputTokens > JUDGE_DEFAULT_MAX_OUTPUT_TOKENS
  )
    fail("JUDGE_OUTPUT_LIMIT_INVALID");

  const hedge = computeHedge(sessionTurns);
  const user = buildJudgeUser(input, hedge.hedgeSpeaker);
  if (user.length > JUDGE_MAX_USER_PROMPT_CHARS) fail("JUDGE_PROMPT_TOO_LARGE");

  const allowedEvidence = new Set([
    ...input.turns
      .filter((turn) => turn.role === "user")
      .map((turn) => turn.id),
    ...input.carryover.map((item) => item.turn),
  ]);
  const clarificationIds = new Set(
    input.current_clarifications.map((item) => item.id),
  );
  const pileIds = new Set(input.pile.map((item) => item.id));

  const validateOutput = (raw: unknown): JudgeOutput => {
    const result = judgeOutputSchema.safeParse(raw);
    if (!result.success) fail("JUDGE_OUTPUT_INVALID");
    const output = result.data;
    const evidence = [
      ...output.evidence_turns,
      ...output.clarifications.flatMap((item) => item.evidence_turns),
      ...output.branches.flatMap((item) => item.evidence_turns),
    ];
    if (evidence.some((id) => !allowedEvidence.has(id)))
      fail("JUDGE_EVIDENCE_UNAVAILABLE");
    if (
      output.invalidate_clarifications.some((id) => !clarificationIds.has(id))
    )
      fail("JUDGE_CLARIFICATION_UNAVAILABLE");
    if (
      output.promote_pile_item !== null &&
      !pileIds.has(output.promote_pile_item)
    )
      fail("JUDGE_PILE_ITEM_UNAVAILABLE");
    return output;
  };

  const validateResponseText = (text: string): JudgeOutput => {
    if (typeof text !== "string" || !text.length) fail("JUDGE_OUTPUT_INVALID");
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      fail("JUDGE_OUTPUT_INVALID");
    }
    return validateOutput(raw);
  };

  const request: JudgeModelRequest = {
    model,
    instructions: JUDGE_SYSTEM,
    input: [
      {
        role: "user",
        content: [{ type: "input_text", text: user }],
      },
    ],
    max_output_tokens: maxOutputTokens,
    reasoning: { effort: reasoningEffort },
    store: false,
    text: { format: { type: "json_object" } },
  };

  return {
    request,
    promptVersion: JUDGE_PROMPT_VERSION,
    hedgeSpeaker: hedge.hedgeSpeaker,
    validateOutput,
    validateResponseText,
  };
}
