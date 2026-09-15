import { withAuthenticatedSupabase } from "@/lib/api/authenticated-handler";
import { dataResponse, problemResponse } from "@/lib/api/problem";
import { RetentionDatabaseError } from "@/lib/supabase/retention";
import {
  restartSourceSchema,
  restartSourceViewSchema,
} from "@/schemas/recovery";
export async function GET(
  _request: Request,
  context: { params: Promise<{ kind: string; id: string }> },
) {
  const source = restartSourceSchema.safeParse(await context.params);
  if (!source.success)
    return problemResponse({
      status: 400,
      code: "INVALID_SOURCE",
      message: "질문을 확인해 주세요.",
    });
  return withAuthenticatedSupabase(async (client) => {
    const r = await client.rpc("read_restart_source", {
      p_kind: source.data.kind,
      p_id: source.data.id,
    });
    if (r.error) throw new RetentionDatabaseError(r.error.message);
    return dataResponse(restartSourceViewSchema.parse(r.data));
  });
}
