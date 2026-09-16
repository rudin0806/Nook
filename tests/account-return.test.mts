import test from "node:test";
import assert from "node:assert/strict";
import { authReturnPath, loginPath } from "../src/lib/auth/return-path.ts";
import { readFlow, callbackMatches } from "../src/lib/auth/policy.ts";
import { readRetentionDraft } from "../src/lib/retention/draft.ts";
import { nicknameSchema } from "../src/schemas/profile.ts";
import { startLogin } from "../src/lib/auth/start.ts";

const id = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const returnTo = `/resume/${id}?retention=1`;
test("return destination rejects external, encoded, and unexpected routes", () => {
  assert.equal(authReturnPath(returnTo), returnTo);
  for (const value of [
    "https://evil.test",
    "//evil.test",
    "/\\evil.test",
    "/resume/../login?retention=1",
    `${returnTo}&x=1`,
    `${returnTo}#token`,
    null,
  ])
    assert.equal(authReturnPath(value), "/drawer");
  assert.ok(loginPath(returnTo, "cancelled").endsWith("#"));
});
test("linking retains the original identity and carries only a safe return route", async () => {
  let calls = 0;
  const result = await startLogin(
    {
      getUser: async () => ({
        data: { user: { id, is_anonymous: true } },
        error: null,
      }),
      linkIdentity: async (request) => {
        calls++;
        assert.equal(
          request.options.redirectTo,
          "https://nook.test/api/auth/callback",
        );
        return { data: { url: "https://provider.test" }, error: null };
      },
      signInWithOAuth: async () => {
        throw new Error("must not switch identity");
      },
    },
    "google",
    "https://nook.test",
  );
  assert.equal(calls, 1);
  assert.equal(result.kind, "redirect");
  const flow = readFlow(
    JSON.stringify({ expectedUserId: id, expiresAt: 600001, returnTo }),
    1,
  )!;
  assert.equal(flow.returnTo, returnTo);
  assert.equal(callbackMatches(flow, { id, is_anonymous: false }), true);
  assert.equal(
    callbackMatches(flow, { id: other, is_anonymous: false }),
    false,
  );
  assert.equal(readFlow(JSON.stringify(flow), 600002), null);
});
test("retention choices cannot be restored across users, sessions, or expiry", () => {
  const raw = JSON.stringify({
    userId: id,
    sessionId: id,
    selected: [other],
    expiresAt: 1000,
  });
  assert.deepEqual(readRetentionDraft(raw, id, id, 1)?.selected, [other]);
  assert.equal(readRetentionDraft(raw, other, id, 1), null);
  assert.equal(readRetentionDraft(raw, id, other, 1), null);
  assert.equal(readRetentionDraft(raw, id, id, 1000), null);
  assert.equal(readRetentionDraft("invalid", id, id), null);
});
test("nickname normalizes whitespace and Korean while rejecting invisible/control/markup input", () => {
  assert.equal(nicknameSchema.parse("  수연_1  "), "수연_1");
  for (const value of [
    "",
    "   ",
    "a".repeat(21),
    "<script>",
    "ab\u202ecd",
    "a\nb",
    "a\u0000b",
  ])
    assert.equal(nicknameSchema.safeParse(value).success, false);
});
