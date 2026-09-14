import { handleAIRequest } from "@/lib/api/ai-http";
import { withAuthenticatedSupabase } from "@/lib/api/authenticated-handler";
import { dataResponse, problemResponse } from "@/lib/api/problem";
import {
  loadConversation,
  conversationView,
} from "@/lib/api/conversation-context";
import { converse } from "@/lib/api/conversation";
import { conversationRequestSchema } from "@/schemas/conversation";
import { z } from "zod";
export const runtime = "nodejs";
export const maxDuration = 180;
export async function POST(request: Request) {
  return handleAIRequest(request, conversationRequestSchema, converse, {
    NOOK_SITE_URL: process.env.NOOK_SITE_URL,
    NOOK_START_API_ENABLED: process.env.NOOK_CONVERSATION_API_ENABLED,
  });
}
export async function GET(request: Request) {
  const id = z
    .uuid()
    .safeParse(new URL(request.url).searchParams.get("nodeId"));
  if (!id.success)
    return problemResponse({
      status: 400,
      code: "INVALID_NODE",
      message: "이야기 주소를 확인해 주세요.",
    });
  if (process.env.NOOK_CONVERSATION_API_ENABLED !== "true")
    return problemResponse({
      status: 503,
      code: "CONVERSATION_NOT_ENABLED",
      message: "이어지는 대화 연결을 준비하고 있어요.",
    });
  return withAuthenticatedSupabase(async (auth) => {
    try {
      return dataResponse(
        conversationView(await loadConversation(auth, id.data)),
      );
    } catch {
      return problemResponse({
        status: 404,
        code: "CONVERSATION_UNAVAILABLE",
        message: "이야기를 열 수 없어요. 로그인과 보관 상태를 확인해 주세요.",
      });
    }
  });
}
