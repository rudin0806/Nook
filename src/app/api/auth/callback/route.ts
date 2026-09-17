import {
  authReturnPath,
  loginPath,
  RETURN_COOKIE,
} from "@/lib/auth/return-path";
import { cookies } from "next/headers";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { problemResponse } from "@/lib/api/problem";
import { authOrigin, authRedirect } from "@/lib/auth/http";
import { FLOW_COOKIE, callbackMatches, readFlow } from "@/lib/auth/policy";

import {
  callbackInputFailure,
  type CallbackFailure,
} from "@/lib/auth/callback-errors";
import { PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal/versions";
import { firstProviderIdentity, identityHash } from "@/lib/auth/identity-hash";

function fail(origin: string, reason: CallbackFailure, returnTo: string) {
  console.warn("nook_auth_callback_failed", reason);
  return authRedirect(origin, loginPath(returnTo, reason));
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
  const returnTo = authReturnPath(
    flow?.returnTo ?? store.get(RETURN_COOKIE)?.value,
  );
  store.delete(RETURN_COOKIE);
  const code = url.searchParams.get("code");
  const failure = callbackInputFailure(url.searchParams, flow);
  if (failure) return fail(origin, failure, returnTo);
  if (!flow || !code) return fail(origin, "callback", returnTo);
  try {
    const supabase = await createSupabaseRouteClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return fail(origin, "exchange", returnTo);
    const { data, error: userError } = await supabase.auth.getUser();
    if (userError) return fail(origin, "session", returnTo);
    if (!callbackMatches(flow, data.user)) {
      // A different account must never receive the anonymous user's records.
      // No data is merged, reassigned, or deleted. Clear only this device session.
      if (data.user && data.user.id !== flow.expectedUserId)
        await supabase.auth.signOut({ scope: "local" });
      return fail(origin, "identity", returnTo);
    }
    // A method that was used to withdraw may not rejoin until its window is up.
    // Supabase has already created the account by this point, so it is removed
    // again here rather than left behind.
    const hash = identityHash(
      firstProviderIdentity(data.user?.identities),
      process.env.NOOK_REQUEST_HMAC_SECRET,
    );
    if (hash) {
      const blocked = await supabase.rpc("rejoin_blocked_until", {
        p_identity_hash: hash,
      });
      if (blocked.error) return fail(origin, "session", returnTo);
      if (blocked.data) {
        await supabase.rpc("delete_own_account", { p_identity_hash: hash });
        try {
          await supabase.auth.signOut({ scope: "local" });
        } catch {}
        return authRedirect(origin, loginPath(returnTo, "rejoin_blocked"));
      }
    }
    if (flow.agreed) {
      // The member is signed in either way; a failed record is an operational
      // problem to notice, not a reason to bounce them back out of the account.
      const { error: consentError } = await supabase.rpc("record_consent", {
        p_terms_version: TERMS_VERSION,
        p_privacy_version: PRIVACY_VERSION,
      });
      if (consentError) console.warn("nook_consent_record_failed");
    }
    return authRedirect(origin, authReturnPath(flow.returnTo));
  } catch {
    return fail(origin, "callback", returnTo);
  }
}
