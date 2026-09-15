import assert from "node:assert/strict";
import test from "node:test";
import { checkAIEnvironment } from "../src/lib/release/environment.ts";
function valid() {
  const env: Record<string, string> = {
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "private-marker-public",
    SUPABASE_SECRET_KEY: "private-marker-secret",
    OPENAI_API_KEY: "private-marker-openai",
    NOOK_REQUEST_HMAC_SECRET: "x".repeat(32),
    NOOK_SITE_URL: "https://nook.example",
  };
  for (const role of [
    "SAFETY",
    "START",
    "NODE_ZERO",
    "JUDGE",
    "REFRAME",
    "REFLECT",
  ]) {
    env[`NOOK_${role}_MODEL`] = "gpt-5.6-sol";
    env[`NOOK_${role}_REASONING_EFFORT`] = "high";
    env[`NOOK_${role}_MAX_OUTPUT_TOKENS`] = "1024";
  }
  return env;
}
test("configuration and enabled rollout are independent; supplied values never appear", () => {
  const env = valid();
  const result = checkAIEnvironment(env);
  assert.equal(result.configured, true);
  assert.equal(result.readyForLiveTest, false);
  assert.equal(JSON.stringify(result).includes("private-marker"), false);
  assert.equal(
    checkAIEnvironment({
      ...env,
      NOOK_START_API_ENABLED: "true",
      NOOK_CONVERSATION_API_ENABLED: "true",
    }).readyForLiveTest,
    true,
  );
  assert.equal(checkAIEnvironment({}).configured, false);
});
test("invalid models, output limits, keys and redirect hosts fail closed", () => {
  for (const overrides of [
    { NOOK_NODE_ZERO_MODEL: "gpt-5.6-luna" },
    { NOOK_REFRAME_MODEL: "gpt-5.6-luna" },
    { NOOK_JUDGE_MODEL: "other" },
    { NOOK_JUDGE_MAX_OUTPUT_TOKENS: "2049" },
    { NOOK_JUDGE_REASONING_EFFORT: "ultra" },
    { OPENAI_API_KEY: " " },
    { NOOK_REQUEST_HMAC_SECRET: "short" },
    { VERCEL_ENV: "preview", VERCEL_URL: "evil.example" },
    { NEXT_PUBLIC_SUPABASE_URL: "https://secret@example.com" },
  ])
    assert.equal(
      checkAIEnvironment({ ...valid(), ...overrides }).configured,
      false,
    );
  assert.equal(
    checkAIEnvironment({
      ...valid(),
      VERCEL_ENV: "preview",
      VERCEL_URL: "nook-test.vercel.app",
    }).configured,
    true,
  );
});
