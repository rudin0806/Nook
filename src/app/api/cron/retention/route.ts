import { createClient } from "@supabase/supabase-js";
import { runRetentionMaintenance } from "@/lib/retention/maintenance";
import { getSupabaseEnvironment } from "@/lib/env/public";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request) {
  return runRetentionMaintenance(
    request,
    {
      CRON_SECRET: process.env.CRON_SECRET,
      NOOK_RETENTION_CRON_ENABLED: process.env.NOOK_RETENTION_CRON_ENABLED,
      VERCEL_ENV: process.env.VERCEL_ENV,
    },
    async () => {
      const key = process.env.SUPABASE_SECRET_KEY;
      if (!key) throw new Error("NOT_CONFIGURED");
      const client = createClient(getSupabaseEnvironment().url, key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });
      const { data, error } = await client
        .rpc("purge_expired_sessions")
        .abortSignal(AbortSignal.timeout(45000));
      if (error) throw new Error("RETENTION_RPC_FAILED");
      // Accounts whose one-month withdrawal window has closed are removed on the
      // same schedule; a failure here must not be reported as a clean run.
      const accounts = await client
        .rpc("purge_expired_accounts")
        .abortSignal(AbortSignal.timeout(45000));
      if (accounts.error) throw new Error("ACCOUNT_PURGE_RPC_FAILED");
      return { sessions: data, accounts: accounts.data };
    },
  );
}
