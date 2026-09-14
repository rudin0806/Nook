import "server-only";
import { createStartFlow } from "@/engine/start-flow";
import { executeSafetyGate } from "@/engine/safety-gate";
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

/** Complete start path for trusted server callers; public auth/quota/persistence remain separate. */
export function createServerStartFlow(
  raw: unknown,
  options: {
    safety: PrepareJudgeOptions;
    start: PrepareJudgeOptions;
    nodeZero: PrepareJudgeOptions;
  },
) {
  return createStartFlow(raw, {
    safetyGate: async (input) => {
      const result = await executeSafetyGate(input, options.safety, {
        moderate: (request) => createOpenAIClient().moderations.create(request),
        classify: transport,
      });
      // The coordinator remaps this strict classifier output; never pass provider extras.
      return { label: result.label, category: result.category };
    },
    classify: (input) => runStartClassification(input, options.start),
    generate: (input) => runNodeZero(input, options.nodeZero),
  });
}
