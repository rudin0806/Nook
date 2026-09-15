import { z } from "zod";
import { withAuthenticatedSupabase } from "@/lib/api/authenticated-handler";
import { dataResponse, problemResponse } from "@/lib/api/problem";
export async function GET(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const id = z.uuid().safeParse((await context.params).sessionId);
  if (!id.success)
    return problemResponse({
      status: 400,
      code: "INVALID_SESSION_ID",
      message: "기록을 확인해 주세요.",
    });
  return withAuthenticatedSupabase(async (client) => {
    const r = await client
      .from("session_origins")
      .select("source_session_id")
      .eq("session_id", id.data)
      .maybeSingle();
    if (r.error) throw new Error("ORIGIN_QUERY_FAILED");
    return dataResponse({ sourceSessionId: r.data?.source_session_id ?? null });
  });
}
