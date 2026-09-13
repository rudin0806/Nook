import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { mapDatabaseProblem, problemResponse } from "@/lib/api/problem";
import { RequestInputError } from "@/lib/api/request";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated";
import { RetentionDatabaseError } from "@/lib/supabase/retention";
import { createSupabaseRouteClient } from "@/lib/supabase/server";

export async function withAuthenticatedSupabase(
  operation: (supabase: SupabaseClient) => Promise<Response>,
) {
  let supabase: SupabaseClient;
  try {
    supabase = await createSupabaseRouteClient();
  } catch {
    return problemResponse({
      status: 503,
      code: "SERVICE_NOT_CONFIGURED",
      message: "데이터 연결이 아직 설정되지 않았어요.",
    });
  }

  let user;
  try {
    user = await getAuthenticatedUser(supabase);
  } catch {
    return problemResponse({
      status: 503,
      code: "AUTH_SERVICE_UNAVAILABLE",
      message: "로그인 상태를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.",
    });
  }
  if (!user) {
    return problemResponse({
      status: 401,
      code: "AUTHENTICATION_REQUIRED",
      message: "로그인이 필요해요.",
    });
  }

  try {
    return await operation(supabase);
  } catch (error) {
    if (error instanceof RequestInputError) {
      return problemResponse({
        status: 400,
        code: error.code,
        message: error.publicMessage,
      });
    }
    if (error instanceof RetentionDatabaseError) {
      return problemResponse(mapDatabaseProblem(error.message));
    }
    return problemResponse({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.",
    });
  }
}
