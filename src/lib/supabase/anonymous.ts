import "server-only";
import { ensureAnonymousActor } from "@/lib/auth/anonymous";
import { createSupabaseRouteClient } from "@/lib/supabase/server";

/** Route Handler / Server Action only. No public signup endpoint is exposed yet.
 * Enable only after CAPTCHA enforcement, request throttling and the start flow
 * are connected. Raw Thought is deliberately not an argument to this helper.
 */
export async function ensureConversationActor(captchaToken?: unknown) {
  const supabase = await createSupabaseRouteClient();
  const actor = await ensureAnonymousActor(supabase.auth, {
    allowCreation: process.env.NOOK_ANONYMOUS_SIGN_IN_ENABLED === "true",
    captchaToken,
  });
  return { supabase, actor };
}
