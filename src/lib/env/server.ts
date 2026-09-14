import "server-only";
import { z } from "zod";
import { NOOK_MODEL_IDS, NOOK_REASONING_EFFORTS } from "@/lib/openai/models";

const openAIEnvironmentSchema = z.object({ apiKey: z.string().min(1) });
const judgeEnvironmentSchema = z.object({
  model: z.enum(NOOK_MODEL_IDS),
  reasoningEffort: z.enum(NOOK_REASONING_EFFORTS),
  maxOutputTokens: z.coerce.number().int().min(256).max(2_048),
});

export function getOpenAIEnvironment() {
  const result = openAIEnvironmentSchema.safeParse({
    apiKey: process.env.OPENAI_API_KEY,
  });

  if (!result.success) {
    throw new Error("OpenAI 연결에 필요한 서버 환경변수를 설정해 주세요.");
  }

  return result.data;
}

export function getJudgeEnvironment() {
  const result = judgeEnvironmentSchema.safeParse({
    model: process.env.NOOK_JUDGE_MODEL,
    reasoningEffort: process.env.NOOK_JUDGE_REASONING_EFFORT,
    maxOutputTokens: process.env.NOOK_JUDGE_MAX_OUTPUT_TOKENS,
  });
  if (!result.success)
    throw new Error("Judge 실행에 필요한 서버 환경변수를 설정해 주세요.");
  return result.data;
}

/** Explicit settings only: do not silently select an operating model. */
export function getStartEnvironment() {
  function read(prefix: string) {
    const result = judgeEnvironmentSchema.safeParse({
      model: process.env[`${prefix}_MODEL`],
      reasoningEffort: process.env[`${prefix}_REASONING_EFFORT`],
      maxOutputTokens: process.env[`${prefix}_MAX_OUTPUT_TOKENS`],
    });
    if (!result.success) throw new Error("START_NOT_CONFIGURED");
    return result.data;
  }
  const safety = read("NOOK_SAFETY"),
    start = read("NOOK_START"),
    nodeZero = read("NOOK_NODE_ZERO");
  if (nodeZero.model === "gpt-5.6-luna")
    throw new Error("NODE_ZERO_MODEL_NOT_ALLOWED");
  getOpenAIEnvironment();
  return { safety, start, nodeZero };
}

export function getConversationEnvironment() {
  const read = (prefix: string) => {
    const result = judgeEnvironmentSchema.safeParse({
      model: process.env[`${prefix}_MODEL`],
      reasoningEffort: process.env[`${prefix}_REASONING_EFFORT`],
      maxOutputTokens: process.env[`${prefix}_MAX_OUTPUT_TOKENS`],
    });
    if (!result.success) throw new Error("CONVERSATION_NOT_CONFIGURED");
    return result.data;
  };
  const config = {
    safety: read("NOOK_SAFETY"),
    judge: read("NOOK_JUDGE"),
    reframe: read("NOOK_REFRAME"),
    reflect: read("NOOK_REFLECT"),
  };
  if (config.reframe.model === "gpt-5.6-luna")
    throw new Error("REFRAME_MODEL_NOT_ALLOWED");
  getOpenAIEnvironment();
  return config;
}
