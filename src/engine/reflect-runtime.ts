import { prepareReflection } from "./reflect.ts";
import {
  executeJson,
  prepareJsonRequest,
  type JsonTransport,
} from "./json-model.ts";
import type { PrepareJudgeOptions } from "./judge.ts";

export async function executeReflection(
  judge: unknown,
  context: unknown,
  options: PrepareJudgeOptions,
  transport: JsonTransport,
) {
  const prepared = prepareReflection(judge, context);
  if (prepared.user.length > 30000) throw new Error("REFLECT_INPUT_TOO_LARGE");
  const request = prepareJsonRequest(
    prepared.system,
    { context: prepared.user },
    options,
  );
  return executeJson(
    request,
    (raw) => {
      const out = prepared.validateOutput(raw);
      if (
        out.question.length > 1000 ||
        /[\r\n]/u.test(out.question) ||
        (out.question.match(/[?？]/gu) ?? []).length !== 1 ||
        !/[?？]$/u.test(out.question)
      )
        throw new Error("REFLECT_OUTPUT_INVALID");
      return out;
    },
    transport,
    "REFLECT",
  );
}
