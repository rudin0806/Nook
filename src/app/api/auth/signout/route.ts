import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { problemResponse } from "@/lib/api/problem";
import { authOrigin, authRedirect } from "@/lib/auth/http";
import { isSameOriginPost } from "@/lib/auth/policy";

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
  try {
    const supabase = await createSupabaseRouteClient();
    const { data, error } = await supabase.auth.getUser();
    if (error && error.name !== "AuthSessionMissingError")
      return authRedirect(origin, "/login?error=session");
    // Anonymous logout would destroy the only access to an unfinished conversation.
    if (data.user?.is_anonymous)
      return authRedirect(origin, "/login?error=anonymous");
    if (data.user) {
      const { error: signoutError } = await supabase.auth.signOut({
        scope: "local",
      });
      if (signoutError) return authRedirect(origin, "/login?error=signout");
    }
    return authRedirect(origin, "/");
  } catch {
    return authRedirect(origin, "/login?error=signout");
  }
}
