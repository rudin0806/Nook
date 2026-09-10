import { z } from "zod";

const supabaseEnvironmentSchema = z.object({
  url: z.url(),
  publishableKey: z.string().min(1),
});

/** Read lazily so the landing page can build before Supabase is configured. */
export function getSupabaseEnvironment() {
  const result = supabaseEnvironmentSchema.safeParse({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });

  if (!result.success) {
    throw new Error("Supabase 연결에 필요한 공개 환경변수를 설정해 주세요.");
  }

  return result.data;
}
