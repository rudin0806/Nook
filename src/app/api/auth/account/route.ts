import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { problemResponse } from "@/lib/api/problem";
import { authOrigin, authRedirect } from "@/lib/auth/http";
import { isSameOriginPost } from "@/lib/auth/policy";

/** Withdrawal. Irreversible: the account row is deleted and every table that
 * holds the member's data cascades from it. Nothing is archived first, so there
 * is no grace period to honour and no restore path to offer.
 */
export async function POST(request: Request) {
  let origin: string;
  try {
    origin = authOrigin();
  } catch {
    return problemResponse({
      status: 503,
      code: "AUTH_NOT_CONFIGURED",
      message: "로그인 연결을 준비하고 있어요.",
    });
  }
  if (!isSameOriginPost(request, origin))
    return problemResponse({
      status: 403,
      code: "INVALID_ORIGIN",
      message: "이 화면에서 다시 시도해 주세요.",
    });
  let acknowledged: unknown;
  try {
    acknowledged = (await request.formData()).get("acknowledged");
  } catch {
    return authRedirect(origin, "/login?error=delete");
  }
  // An irreversible deletion is never inferred from the request alone.
  if (acknowledged !== "on")
    return authRedirect(origin, "/login?error=delete_confirm");
  try {
    const supabase = await createSupabaseRouteClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user)
      return authRedirect(origin, "/login?error=session");
    const { error: deleteError } = await supabase.rpc("delete_own_account");
    if (deleteError) return authRedirect(origin, "/login?error=delete");
    // The session is already gone server-side; this only clears local cookies,
    // so a failure here must not be reported as a failed withdrawal.
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {}
    return authRedirect(origin, "/login?deleted=1");
  } catch {
    return authRedirect(origin, "/login?error=delete");
  }
}
