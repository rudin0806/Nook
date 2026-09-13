import { dataResponse, problemResponse } from "@/lib/api/problem";
import { parseJson } from "@/lib/api/request";
import { withAuthenticatedSupabase } from "@/lib/api/authenticated-handler";
import { finalizeRetention } from "@/lib/supabase/retention";
import { finalizeRetentionSchema, sessionIdSchema } from "@/schemas/retention";

type RouteContext = { params: Promise<{ sessionId: string }> };

export async function POST(request: Request, context: RouteContext) {
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
