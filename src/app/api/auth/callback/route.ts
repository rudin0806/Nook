import { cookies } from "next/headers";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { problemResponse } from "@/lib/api/problem";
import { authOrigin, authRedirect } from "@/lib/auth/http";
import { FLOW_COOKIE, callbackMatches, readFlow } from "@/lib/auth/policy";

import {
  callbackInputFailure,
  callbackFailurePath,
  type CallbackFailure,
} from "@/lib/auth/callback-errors";

function fail(origin: string, reason: CallbackFailure) {
  console.warn("nook_auth_callback_failed", reason);
  return authRedirect(origin, callbackFailurePath(reason));
}

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
  const failure = callbackInputFailure(url.searchParams, flow);
  if (failure) return fail(origin, failure);
  if (!flow || !code) return fail(origin, "callback");
  try {
    const supabase = await createSupabaseRouteClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return fail(origin, "exchange");
    const { data, error: userError } = await supabase.auth.getUser();
    if (userError) return fail(origin, "session");
    if (!callbackMatches(flow, data.user)) {
      // A different account must never receive the anonymous user's records.
      // No data is merged, reassigned, or deleted. Clear only this device session.
      if (data.user && data.user.id !== flow.expectedUserId)
        await supabase.auth.signOut({ scope: "local" });
      return fail(origin, "identity");
    }
    return authRedirect(origin, "/drawer");
  } catch {
    return fail(origin, "callback");
  }
}
