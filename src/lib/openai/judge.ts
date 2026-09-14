import "server-only";
import { prepareJudge } from "@/engine/judge";
import { getJudgeEnvironment } from "@/lib/env/server";
import { createOpenAIClient } from "@/lib/openai/server";

export async function runJudge(rawInput: unknown, rawSessionTurns: unknown) {
  const config = getJudgeEnvironment();
  const prepared = prepareJudge(rawInput, rawSessionTurns, config);
  const client = createOpenAIClient();
  const startedAt = Date.now();
  let response;
  try {
    response = await client.responses.create(prepared.request);
  } catch {
    throw new Error("JUDGE_PROVIDER_FAILED");
  }
  if (response.status !== "completed")
    throw new Error("JUDGE_RESPONSE_INCOMPLETE");
  const output = prepared.validateResponseText(response.output_text);
  return {
    output,
    metadata: {
      configuredModel: prepared.request.model,
      resolvedModel: response.model,
      reasoningEffort: prepared.request.reasoning.effort,
      promptVersion: prepared.promptVersion,
      latencyMs: Date.now() - startedAt,
      inputTokens: response.usage?.input_tokens ?? null,
      outputTokens: response.usage?.output_tokens ?? null,
      hedgeSpeaker: prepared.hedgeSpeaker,
    },
  };
}
