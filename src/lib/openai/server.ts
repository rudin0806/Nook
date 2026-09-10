import "server-only";
import OpenAI from "openai";
import { getOpenAIEnvironment } from "@/lib/env/server";

/** SDK setup only. No model calls or billable operations in STEP 1. */
export function createOpenAIClient() {
  const { apiKey } = getOpenAIEnvironment();
  return new OpenAI({ apiKey, timeout: 30_000, maxRetries: 1 });
}
