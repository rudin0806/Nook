import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnvironment } from "@/lib/env/public";

/** For Server Components, which cannot write response cookies.
 *
 * The route client's `setAll` calls `cookieStore.set`, and Next.js throws
 * "Cookies can only be modified in a Server Action or Route Handler" when a
 * page render does that. Supabase reaches `setAll` on its own, from
 * `_callRefreshToken`, so any page that asked `auth.getUser()` with an expired
 * access token threw — and the rotated tokens were lost, which signed the
 * member out for good.
 *
 * Writing is a no-op here. Refreshing belongs to `middleware.ts`, which runs
 * before the render and can write, so by the time a page reads the session it
 * is already fresh and nothing needs saving.
 */
export async function createSupabaseReaderClient() {
  const { url, publishableKey } = getSupabaseEnvironment();
  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {
        // Deliberately empty. See above.
      },
    },
  });
}
