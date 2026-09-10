"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnvironment } from "@/lib/env/public";

/** Call from an auth/data service; components must not own database queries. */
export function createSupabaseBrowserClient() {
  const { url, publishableKey } = getSupabaseEnvironment();
  return createBrowserClient(url, publishableKey);
}
