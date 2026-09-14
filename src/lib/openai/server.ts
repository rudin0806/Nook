import "server-only";
import OpenAI from "openai";
import { getOpenAIEnvironment } from "@/lib/env/server";

/** Server-only SDK factory. Callers decide whether an operation is billable. */
export function createOpenAIClient() {
  const { apiKey } = getOpenAIEnvironment();
  return new OpenAI({ apiKey, timeout: 30_000, maxRetries: 0 });
}
