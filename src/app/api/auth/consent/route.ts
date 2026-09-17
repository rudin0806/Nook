import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { problemResponse } from "@/lib/api/problem";
import { authOrigin, authRedirect } from "@/lib/auth/http";
import { isSameOriginPost } from "@/lib/auth/policy";
import { consentReturnPath } from "@/lib/legal/return-path";
import { PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal/versions";

function back(origin: string, returnTo: string) {
  return authRedirect(
    origin,
    `/consent?error=agree&returnTo=${encodeURIComponent(returnTo)}`,
  );
}

/** Agreeing again after a material change. The same definer function records
 * it, so a client still cannot backdate or forge an agreement.
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
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return back(origin, "/");
  }
  const returnTo = consentReturnPath(form.get("returnTo"));
  if (form.get("agreed") !== "on") return back(origin, returnTo);
  try {
    const supabase = await createSupabaseRouteClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user)
      return authRedirect(origin, "/login?error=session");
    const { error: recordError } = await supabase.rpc("record_consent", {
      p_terms_version: TERMS_VERSION,
      p_privacy_version: PRIVACY_VERSION,
    });
    if (recordError) return back(origin, returnTo);
    return authRedirect(origin, returnTo);
  } catch {
    return back(origin, "/");
  }
}
