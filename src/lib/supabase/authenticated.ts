import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";

export async function getAuthenticatedUser(
  supabase: SupabaseClient,
): Promise<User | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}
