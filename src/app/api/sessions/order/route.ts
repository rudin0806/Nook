import { withAuthenticatedSupabase } from "@/lib/api/authenticated-handler";
import { dataResponse } from "@/lib/api/problem";
import { parseJson } from "@/lib/api/request";
import { reorderSavedSessions } from "@/lib/supabase/retention";
import { savedSessionOrderSchema } from "@/schemas/retention";

export async function PATCH(request: Request) {
  return withAuthenticatedSupabase(async (supabase) => {
    const input = await parseJson(request, savedSessionOrderSchema);
    return dataResponse(await reorderSavedSessions(supabase, input));
  });
}
