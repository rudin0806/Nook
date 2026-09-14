import { handleAIRequest } from "@/lib/api/ai-http";
import { startConversation } from "@/lib/api/start";
import { startRequestSchema } from "@/schemas/start-api";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function POST(request: Request) {
  return handleAIRequest(request, startRequestSchema, startConversation);
}
