import "server-only";
import { z } from "zod";

const openAIEnvironmentSchema = z.object({ apiKey: z.string().min(1) });

export function getOpenAIEnvironment() {
  const result = openAIEnvironmentSchema.safeParse({
    apiKey: process.env.OPENAI_API_KEY,
  });

  if (!result.success) {
    throw new Error("OpenAI 연결에 필요한 서버 환경변수를 설정해 주세요.");
  }

  return result.data;
}
