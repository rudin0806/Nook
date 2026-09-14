import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnvironment } from "@/lib/env/public";

/** For Route Handlers / Server Actions, where response cookies can be written.
 * OAuth handlers and retention APIs share this cookie-backed client.
 */
export async function createSupabaseRouteClient() {
  const { url, publishableKey } = getSupabaseEnvironment();
  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, options);
        }
      },
    },
  });
}
