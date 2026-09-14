import "server-only";
import { executeReframe } from "@/engine/reframe";
import type { PrepareJudgeOptions } from "@/engine/judge";
import { createOpenAIClient } from "@/lib/openai/server";

/** Caller supplies server-owned context/config after Safety and structural gates. */
export async function runReframe(
  rawJudge: unknown,
  rawInput: unknown,
  rawSessionTurns: unknown,
  options: PrepareJudgeOptions,
) {
  return executeReframe(
    rawJudge,
    rawInput,
    rawSessionTurns,
    options,
    async (request) => {
      const client = createOpenAIClient();
      return client.responses.create(request);
    },
  );
}
