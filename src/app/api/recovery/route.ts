import { withAuthenticatedSupabase } from "@/lib/api/authenticated-handler";
import { dataResponse, problemResponse } from "@/lib/api/problem";
import { RetentionDatabaseError } from "@/lib/supabase/retention";
import { recoveryItemSchema } from "@/schemas/recovery";
import { retentionListQuerySchema } from "@/schemas/retention";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = retentionListQuerySchema.safeParse({
    limit: url.searchParams.get("limit") ?? 3,
    offset: url.searchParams.get("offset") ?? 0,
  });
  if (!q.success)
    return problemResponse({
      status: 400,
      code: "INVALID_QUERY",
      message: "조회 범위를 확인해 주세요.",
    });
  return withAuthenticatedSupabase(async (client) => {
    const r = await client.rpc("list_recoverable_sessions", {
      p_limit: q.data.limit,
      p_offset: q.data.offset,
    });
    if (r.error) throw new RetentionDatabaseError(r.error.message);
    const items = recoveryItemSchema.array().max(51).parse(r.data);
    return dataResponse({
      items: items.slice(0, q.data.limit),
      hasMore: items.length > q.data.limit,
    });
  });
}
