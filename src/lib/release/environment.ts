import { deploymentOrigin } from "../auth/policy.ts";
import { judgeEnvironmentSchema } from "../env/model-schema.ts";

type Environment = Record<string, string | undefined>;
type Check = { name: string; passed: boolean };
/** Offline structural checks only. Never include supplied values or validation errors. */
export function checkAIEnvironment(env: Environment) {
  const checks: Check[] = [];
  const add = (name: string, passed: boolean) => checks.push({ name, passed });
  for (const name of [
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SECRET_KEY",
    "OPENAI_API_KEY",
  ])
    add(name, Boolean(env[name]?.trim()));
  add(
    "NOOK_REQUEST_HMAC_SECRET",
    (env.NOOK_REQUEST_HMAC_SECRET?.length ?? 0) >= 32,
  );
  let originValid = false;
  try {
    deploymentOrigin(env);
    originValid = true;
  } catch {
    /* values must stay private */
  }
  add("DEPLOYMENT_ORIGIN", originValid);
  let databaseUrlValid = false;
  try {
    const url = new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    databaseUrlValid =
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash;
  } catch {
    /* values must stay private */
  }
  add("NEXT_PUBLIC_SUPABASE_URL", databaseUrlValid);
  for (const role of [
    "SAFETY",
    "START",
    "NODE_ZERO",
    "JUDGE",
    "REFRAME",
    "REFLECT",
  ]) {
    const prefix = `NOOK_${role}`;
    const parsed = judgeEnvironmentSchema.safeParse({
      model: env[`${prefix}_MODEL`],
      reasoningEffort: env[`${prefix}_REASONING_EFFORT`],
      maxOutputTokens: env[`${prefix}_MAX_OUTPUT_TOKENS`],
    });
    add(
      `${prefix}_CONFIG`,
      parsed.success &&
        (!(role === "NODE_ZERO" || role === "REFRAME") ||
          parsed.data.model !== "gpt-5.6-luna"),
    );
  }
  const startEnabled = env.NOOK_START_API_ENABLED === "true";
  const conversationEnabled = env.NOOK_CONVERSATION_API_ENABLED === "true";
  return {
    scope:
      "Offline configuration shape only; no API calls, credential verification or rollout changes",
    checks,
    configured: checks.every((c) => c.passed),
    rollout: { startEnabled, conversationEnabled },
    readyForLiveTest:
      checks.every((c) => c.passed) && startEnabled && conversationEnabled,
  };
}
