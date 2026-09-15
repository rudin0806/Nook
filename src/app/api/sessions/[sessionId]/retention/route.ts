import { isSameOriginPost, siteOrigin } from "@/lib/auth/policy";
import { dataResponse, problemResponse } from "@/lib/api/problem";
import { parseJson } from "@/lib/api/request";
import { withAuthenticatedSupabase } from "@/lib/api/authenticated-handler";
import { finalizeRetention } from "@/lib/supabase/retention";
import { finalizeRetentionSchema, sessionIdSchema } from "@/schemas/retention";

type RouteContext = { params: Promise<{ sessionId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    if (!isSameOriginPost(request, siteOrigin(process.env.NOOK_SITE_URL)))
      return problemResponse({
        status: 403,
        code: "ORIGIN_REJECTED",
        message: "현재 페이지에서 다시 요청해 주세요.",
      });
  } catch {
    return problemResponse({
      status: 503,
      code: "SERVICE_NOT_CONFIGURED",
      message: "서비스 연결을 확인하고 있어요.",
    });
  }
  const { sessionId: candidate } = await context.params;
  const sessionId = sessionIdSchema.safeParse(candidate);
  if (!sessionId.success) {
    return problemResponse({
      status: 400,
      code: "INVALID_SESSION_ID",
      message: "기록 식별자를 확인해 주세요.",
    });
  }

  return withAuthenticatedSupabase(async (supabase) => {
    const input = await parseJson(request, finalizeRetentionSchema);
    return dataResponse(
      await finalizeRetention(supabase, sessionId.data, input),
    );
  });
}
