import { withAuthenticatedSupabase } from "@/lib/api/authenticated-handler";
import { dataResponse, problemResponse } from "@/lib/api/problem";
import { restoreSession } from "@/lib/supabase/retention";
import { sessionIdSchema } from "@/schemas/retention";

type RouteContext = { params: Promise<{ sessionId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const { sessionId: candidate } = await context.params;
  const sessionId = sessionIdSchema.safeParse(candidate);
  if (!sessionId.success) {
    return problemResponse({
      status: 400,
      code: "INVALID_SESSION_ID",
      message: "기록 식별자를 확인해 주세요.",
    });
  }

  return withAuthenticatedSupabase(async (supabase) =>
    dataResponse(await restoreSession(supabase, sessionId.data)),
  );
}
