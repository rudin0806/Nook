import { cookies } from "next/headers";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { problemResponse } from "@/lib/api/problem";
import { authOrigin, authRedirect } from "@/lib/auth/http";
import { FLOW_COOKIE, callbackMatches, readFlow } from "@/lib/auth/policy";

export async function GET(request: Request) {
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
  const store = await cookies();
  const flow = readFlow(store.get(FLOW_COOKIE)?.value);
  store.delete(FLOW_COOKIE);
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!flow || !code || code.length > 4096 || url.searchParams.has("error"))
    return authRedirect(origin, "/login?error=callback");
  try {
    const supabase = await createSupabaseRouteClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return authRedirect(origin, "/login?error=callback");
    const { data, error: userError } = await supabase.auth.getUser();
    if (userError || !callbackMatches(flow, data.user)) {
      // A different account must never receive the anonymous user's records.
      // No data is merged, reassigned, or deleted. Clear only this device session.
      if (data.user && data.user.id !== flow.expectedUserId)
        await supabase.auth.signOut({ scope: "local" });
      return authRedirect(origin, "/login?error=identity");
    }
    return authRedirect(origin, "/drawer");
  } catch {
    return authRedirect(origin, "/login?error=callback");
  }
}
