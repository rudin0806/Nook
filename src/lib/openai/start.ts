import "server-only";
import { executeStartClassification, executeNodeZero } from "@/engine/start";
import { executeSafety } from "@/engine/safety";
import { createOpenAIClient } from "@/lib/openai/server";
import type { PrepareJudgeOptions } from "@/engine/judge";
import type { JsonTransport } from "@/engine/json-model";
const transport: JsonTransport = (request) =>
  createOpenAIClient().responses.create(request);
/** Classifier is one stage of Safety Gate; it does not replace Moderation. */
export const runSafetyClassifier = (
  input: unknown,
  options: PrepareJudgeOptions,
) => executeSafety(input, options, transport);
/** Caller must run the complete trusted Safety Gate first. */
export const runStartClassification = (
  input: unknown,
  options: PrepareJudgeOptions,
) => executeStartClassification(input, options, transport);
export const runNodeZero = (input: unknown, options: PrepareJudgeOptions) =>
  executeNodeZero(input, options, transport);
