import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnvironment } from "@/lib/env/public";

/** The one place the Supabase session is refreshed.
 *
 * Without this, a page render was the thing that discovered an expired access
 * token, and a render cannot write cookies: Next.js threw, the rotated refresh
 * token was never saved, and the copy still in the browser was already dead at
 * Supabase. The member was then signed out silently and every API answered 401.
 *
 * Middleware runs before the render and can write, so the refresh lands here
 * and pages only ever read a fresh token.
 *
 * It fails open. An auth problem must not turn into a blank site, so any error
 * returns the untouched response and lets the route decide what the visitor
 * can see.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  try {
    const { url, publishableKey } = getSupabaseEnvironment();
    const supabase = createServerClient(url, publishableKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet)
            request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet)
            response.cookies.set(name, value, options);
        },
      },
    });
    // Reading the user is what triggers the refresh. The result is not used
    // here — the route re-reads it and enforces its own rules.
    await supabase.auth.getUser();
  } catch {
    return response;
  }

  return response;
}

export const config = {
  /** Everything but static assets. The auth callback and sign-out write their
   * own cookies in a Route Handler, so they are skipped to keep one writer per
   * request. */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/auth/callback|api/auth/signout|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
