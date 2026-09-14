import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnvironment } from "@/lib/env/public";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { runAdmittedRequest, type AdmissionStore } from "@/engine/admission";

/** Authenticated server entry point; no public paid endpoint is exposed here. */
export async function createAdmissionContext() {
  const auth = await createSupabaseRouteClient();
  const { data, error } = await auth.auth.getUser();
  if (error || !data.user) throw new Error("AUTHENTICATION_REQUIRED");
  const key = process.env.SUPABASE_SECRET_KEY;
  const secret = process.env.NOOK_REQUEST_HMAC_SECRET;
  if (!key || !secret || secret.length < 32)
    throw new Error("ADMISSION_NOT_CONFIGURED");
  const admin = createClient(getSupabaseEnvironment().url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const store: AdmissionStore = {
    async claim(userId, requestId, fingerprint) {
      const result = await admin.rpc("claim_ai_request", {
        p_user: userId,
        p_request: requestId,
        p_fingerprint: fingerprint,
      });
      if (result.error) throw new Error("ADMISSION_UNAVAILABLE");
      return result.data;
    },
    async finish(userId, requestId, token, success, resultId) {
      const result = await admin.rpc("finish_ai_request", {
        p_user: userId,
        p_request: requestId,
        p_token: token,
        p_success: success,
        p_result: resultId,
      });
      if (result.error) throw new Error("ADMISSION_UNAVAILABLE");
      return result.data === true;
    },
  };
  return { auth, admin, userId: data.user.id, secret, store };
}

export async function withAIAdmission(
  input: { requestId: string; operation: string; body: string },
  operation: (userId: string) => Promise<string | null>,
) {
  const { userId, secret, store } = await createAdmissionContext();
  return runAdmittedRequest({ ...input, userId }, secret, store, () =>
    operation(userId),
  );
}
