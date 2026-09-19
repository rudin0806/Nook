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

/** 첫 질문까지 걸린 시간을 단계별로 감싸는 자리. 기본값은 그대로 실행하는 것이라
 *  엔진과 평가 하네스는 이 인자를 모르고도 지금까지처럼 돈다. */
export type StageWrapper = <T>(
  name: string,
  model: string | null,
  run: () => Promise<T>,
) => Promise<T>;
const runDirectly: StageWrapper = (_name, _model, run) => run();

/** Complete start path for trusted server callers; public auth/quota/persistence remain separate. */
export function createServerStartFlow(
  raw: unknown,
  options: {
    safety: PrepareJudgeOptions;
    start: PrepareJudgeOptions;
    nodeZero: PrepareJudgeOptions;
  },
  stage: StageWrapper = runDirectly,
) {
  return createStartFlow(raw, {
    safetyGate: (input) =>
      stage("SAFETY", options.safety.model, async () => {
        const result = await executeSafetyGate(input, options.safety, {
          moderate: (request) =>
            createOpenAIClient().moderations.create(request),
          classify: transport,
        });
        // The coordinator remaps this strict classifier output; never pass provider extras.
        return { label: result.label, category: result.category };
      }),
    classify: (input) =>
      stage("START", options.start.model, () =>
        runStartClassification(input, options.start),
      ),
    generate: (input) =>
      stage("NODE_ZERO", options.nodeZero.model, () =>
        runNodeZero(input, options.nodeZero),
      ),
  });
}
