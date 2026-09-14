import {
  requireNookModelId,
  requireNookReasoningEffort,
} from "../lib/openai/models.ts";
import type { JudgeModelRequest, PrepareJudgeOptions } from "./judge.ts";
export type JsonTransport = (request: JudgeModelRequest) => Promise<{
  status?: string;
  output_text: string;
}>;
export function prepareJsonRequest(
  instructions: string,
  input: unknown,
  options: PrepareJudgeOptions,
): JudgeModelRequest {
  const model = requireNookModelId(options.model);
  const effort = requireNookReasoningEffort(options.reasoningEffort);
  const limit = options.maxOutputTokens ?? 2048;
  if (!Number.isInteger(limit) || limit < 256 || limit > 2048)
    throw new Error("OUTPUT_LIMIT_INVALID");
  return {
    model,
    instructions,
    input: [
      {
        role: "user",
        content: [{ type: "input_text", text: JSON.stringify(input) }],
      },
    ],
    max_output_tokens: limit,
    reasoning: { effort },
    store: false,
    text: { format: { type: "json_object" } },
  };
}
/** No retries, no raw provider errors, no persistence. */
export async function executeJson<T>(
  request: JudgeModelRequest,
  validate: (value: unknown) => T,
  transport: JsonTransport,
  code: string,
): Promise<T> {
  let response;
  try {
    response = await transport(request);
  } catch {
    throw new Error(`${code}_PROVIDER_FAILED`);
  }
  if (
    response?.status !== "completed" ||
    typeof response.output_text !== "string"
  )
    throw new Error(`${code}_RESPONSE_INCOMPLETE`);
  if (response.output_text.length > 30_000)
    throw new Error(`${code}_OUTPUT_INVALID`);
  let raw: unknown;
  try {
    raw = JSON.parse(response.output_text);
  } catch {
    throw new Error(`${code}_OUTPUT_INVALID`);
  }
  return validate(raw);
}
