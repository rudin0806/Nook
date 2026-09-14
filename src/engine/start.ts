import {
  startInputSchema,
  startOutputSchema,
  nodeZeroInputSchema,
  nodeZeroOutputSchema,
} from "../schemas/start.ts";
import { START_SYSTEM } from "../prompts/prompt-start.ts";
import { NODE_ZERO_SYSTEM } from "../prompts/prompt-node-zero.ts";
import {
  prepareJsonRequest,
  executeJson,
  type JsonTransport,
} from "./json-model.ts";
import type { PrepareJudgeOptions } from "./judge.ts";
/** Internal stages: call only after the trusted Safety Gate permits CONTINUE. */
export async function executeStartClassification(
  raw: unknown,
  options: PrepareJudgeOptions,
  transport: JsonTransport,
) {
  const input = startInputSchema.safeParse(raw);
  if (!input.success) throw new Error("START_INPUT_INVALID");
  const request = prepareJsonRequest(START_SYSTEM, input.data, options);
  return executeJson(
    request,
    (value) => {
      const parsed = startOutputSchema.safeParse(value);
      if (
        !parsed.success ||
        parsed.data.focus_candidates.some(
          (v) => !input.data.raw_thought.includes(v),
        )
      )
        throw new Error("START_OUTPUT_INVALID");
      return parsed.data;
    },
    transport,
    "START",
  );
}
export async function executeNodeZero(
  raw: unknown,
  options: PrepareJudgeOptions,
  transport: JsonTransport,
) {
  const input = nodeZeroInputSchema.safeParse(raw);
  if (!input.success) throw new Error("NODE_ZERO_INPUT_INVALID");
  if (!["gpt-5.6-terra", "gpt-5.6-sol"].includes(options.model))
    throw new Error("NODE_ZERO_MODEL_NOT_ALLOWED");
  const request = prepareJsonRequest(NODE_ZERO_SYSTEM, input.data, options);
  return executeJson(
    request,
    (value) => {
      const parsed = nodeZeroOutputSchema.safeParse(value);
      if (
        !parsed.success ||
        new Set(parsed.data.evidence_quotes).size !==
          parsed.data.evidence_quotes.length ||
        parsed.data.evidence_quotes.some(
          (v) =>
            !input.data.raw_thought.includes(v) &&
            !input.data.focus_reply?.includes(v),
        )
      )
        throw new Error("NODE_ZERO_OUTPUT_INVALID");
      return parsed.data;
    },
    transport,
    "NODE_ZERO",
  );
}
