import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { problemResponse } from "@/lib/api/problem";
import { authOrigin, authRedirect } from "@/lib/auth/http";
import { isSameOriginPost } from "@/lib/auth/policy";

async function guard(request: Request) {
  const origin = authOrigin();
  if (!isSameOriginPost(request, origin))
    return {
      origin,
      refusal: problemResponse({
        status: 403,
        code: "INVALID_ORIGIN",
        message: "이 화면에서 다시 시도해 주세요.",
      }),
    };
  return { origin, refusal: null };
}

/** Withdrawal. The account is marked rather than removed: it is held for a
 * month so a member can take the request back, and a scheduled purge deletes it
 * once the window closes. Cancelling is the same endpoint with intent=cancel.
 */
export async function POST(request: Request) {
  let origin: string;
  let refusal: Response | null;
  try {
    ({ origin, refusal } = await guard(request));
  } catch {
    return problemResponse({
      status: 503,
      code: "AUTH_NOT_CONFIGURED",
      message: "로그인 연결을 준비하고 있어요.",
    });
  }
  if (refusal) return refusal;
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return authRedirect(origin, "/login?error=delete");
  }
  const cancelling = form.get("intent") === "cancel";
  // An irreversible request is never inferred from the request alone.
  if (!cancelling && form.get("acknowledged") !== "on")
    return authRedirect(origin, "/login?error=delete_confirm");
  try {
    const supabase = await createSupabaseRouteClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user)
      return authRedirect(origin, "/login?error=session");
    if (cancelling) {
      const { error: cancelError } = await supabase.rpc(
        "cancel_account_deletion",
      );
      if (cancelError) return authRedirect(origin, "/login?error=delete");
      return authRedirect(origin, "/login?restored=1");
    }
    const { error: requestError } = await supabase.rpc(
      "request_account_deletion",
    );
    if (requestError) return authRedirect(origin, "/login?error=delete");
    // The account still exists during the window, so the session is ended here
    // rather than left open on a device that asked to leave.
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {}
    return authRedirect(origin, "/login?deleted=1");
  } catch {
    return authRedirect(origin, "/login?error=delete");
  }
}
