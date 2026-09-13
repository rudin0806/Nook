import { dataResponse, problemResponse } from "@/lib/api/problem";
import { withAuthenticatedSupabase } from "@/lib/api/authenticated-handler";
import { listSessions } from "@/lib/supabase/retention";
import { retentionListQuerySchema } from "@/schemas/retention";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = retentionListQuerySchema.safeParse({
    collection: url.searchParams.get("collection") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
  });

  if (!parsed.success) {
    return problemResponse({
      status: 400,
      code: "INVALID_QUERY",
      message: "목록 조회 조건을 확인해 주세요.",
    });
  }

  return withAuthenticatedSupabase(async (supabase) =>
    dataResponse(await listSessions(supabase, parsed.data)),
  );
}
