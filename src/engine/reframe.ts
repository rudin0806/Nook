import {
  prepareJudge,
  type JudgeModelRequest,
  type PrepareJudgeOptions,
} from "./judge.ts";
import { judgeInputSchema, judgeOutputSchema } from "../schemas/judge.ts";
import { reframeOutputSchema } from "../schemas/reframe.ts";
import {
  REFRAME_SYSTEM,
  REFRAME_PROMPT_VERSION,
} from "../prompts/prompt-reframe.ts";

const normalize = (text: string) =>
  text.normalize("NFKC").replace(/[\s\p{P}]/gu, "");

/** Trusted server context only. No DB fallback, no model rejudgement, no writes. */
export function prepareReframe(
  rawJudge: unknown,
  rawInput: unknown,
  rawSessionTurns: unknown,
  options: PrepareJudgeOptions,
) {
  const parsedJudge = judgeOutputSchema.safeParse(rawJudge);
  if (!parsedJudge.success) throw new Error("REFRAME_JUDGE_INVALID");
  if (parsedJudge.data.action !== "SHIFT")
    throw new Error("REFRAME_SHIFT_REQUIRED");
  if (!["gpt-5.6-terra", "gpt-5.6-sol"].includes(options.model))
    throw new Error("REFRAME_MODEL_NOT_ALLOWED");
  // Reuse the existing context, ownership-of-evidence and configuration checks.
  // This prepares a request only; it does NOT call Judge again.
  const judgeContext = prepareJudge(rawInput, rawSessionTurns, options);
  const judge = judgeContext.validateOutput(parsedJudge.data);
  const input = judgeInputSchema.parse(rawInput);
  const source = new Map([
    ...input.turns
      .filter((t) => t.role === "user")
      .map((t) => [t.id, t.text] as const),
    ...input.carryover.map((t) => [t.turn, t.text] as const),
  ]);
  const evidence = judge.evidence_turns.map((id) => {
    const text = source.get(id);
    if (text === undefined) throw new Error("REFRAME_EVIDENCE_UNAVAILABLE");
    return { id, text };
  });
  // Promotion provenance stays on the server. Old saved wording isn't new evidence.
  const user = JSON.stringify({
    main_question: input.main_question,
    main_path: input.main_path,
    turns: input.turns,
    evidence,
  });
  if (user.length > 30_000) throw new Error("REFRAME_PROMPT_TOO_LARGE");
  const existing = new Set(
    [input.main_question, ...input.main_path].map(normalize),
  );
  const request: JudgeModelRequest = {
    ...judgeContext.request,
    instructions: REFRAME_SYSTEM,
    input: [{ role: "user", content: [{ type: "input_text", text: user }] }],
  };
  return {
    request,
    promptVersion: REFRAME_PROMPT_VERSION,
    provenance: {
      evidenceTurnIds: [...judge.evidence_turns],
      promotedBranchId: judge.promote_pile_item,
    },
    validateResponseText(text: string) {
      let raw: unknown;
      try {
        raw = JSON.parse(text);
      } catch {
        throw new Error("REFRAME_OUTPUT_INVALID");
      }
      const result = reframeOutputSchema.safeParse(raw);
      if (!result.success) throw new Error("REFRAME_OUTPUT_INVALID");
      if (existing.has(normalize(result.data.question)))
        throw new Error("REFRAME_DUPLICATE_QUESTION");
      // Semantic equivalence, evidence entailment and tone still require model eval.
      return result.data;
    },
  };
}

type Response = {
  status?: string;
  output_text: string;
  model?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
};
type Transport = (request: JudgeModelRequest) => Promise<Response>;

/** Fail closed: invalid output isn't returned as a proposal; no automatic retry. */
export async function executeReframe(
  rawJudge: unknown,
  rawInput: unknown,
  rawSessionTurns: unknown,
  options: PrepareJudgeOptions,
  transport: Transport,
) {
  const prepared = prepareReframe(rawJudge, rawInput, rawSessionTurns, options);
  const start = Date.now();
  let response: Response;
  try {
    response = await transport(prepared.request);
  } catch {
    throw new Error("REFRAME_PROVIDER_FAILED");
  }
  if (response.status !== "completed")
    throw new Error("REFRAME_RESPONSE_INCOMPLETE");
  const output = prepared.validateResponseText(response.output_text);
  return {
    output,
    provenance: prepared.provenance,
    metadata: {
      promptVersion: prepared.promptVersion,
      configuredModel: prepared.request.model,
      resolvedModel: response.model ?? null,
      latencyMs: Date.now() - start,
      inputTokens: response.usage?.input_tokens ?? null,
      outputTokens: response.usage?.output_tokens ?? null,
    },
  };
}
