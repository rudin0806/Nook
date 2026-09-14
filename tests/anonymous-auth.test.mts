import assert from "node:assert/strict";
import test from "node:test";
import {
  ensureAnonymousActor,
  type AnonymousAuth,
} from "../src/lib/auth/anonymous.ts";
const id = "11111111-1111-4111-8111-111111111111";
function fixture(anonymous: boolean | null) {
  let user: unknown =
    anonymous === null ? null : { id, is_anonymous: anonymous };
  let calls = 0;
  const auth: AnonymousAuth = {
    async getUser() {
      return {
        data: { user },
        error: user ? null : { name: "AuthSessionMissingError" },
      };
    },
    async signInAnonymously(input) {
      calls++;
      assert.equal(input.options.captchaToken, "test-token");
      user = { id, is_anonymous: true };
      return { data: { user }, error: null };
    },
  };
  return { auth, count: () => calls };
}
test("existing permanent and anonymous users retain their IDs without signup or CAPTCHA", async () => {
  for (const anonymous of [true, false]) {
    const f = fixture(anonymous);
    assert.deepEqual(
      await ensureAnonymousActor(f.auth, { allowCreation: false }),
      { userId: id, anonymous, created: false },
    );
    assert.equal(f.count(), 0);
  }
});
test("creation is disabled by default and missing/oversized CAPTCHA never reaches signup", async () => {
  const f = fixture(null);
  await assert.rejects(
    ensureAnonymousActor(f.auth, {
      allowCreation: false,
      captchaToken: "test-token",
    }),
    /ANONYMOUS_CREATION_DISABLED/,
  );
  for (const captchaToken of [undefined, " ", 123, "a".repeat(4097)])
    await assert.rejects(
      ensureAnonymousActor(f.auth, { allowCreation: true, captchaToken }),
      /CAPTCHA_REQUIRED/,
    );
  assert.equal(f.count(), 0);
});
test("new anonymous session is independently verified and then reused", async () => {
  const f = fixture(null);
  assert.deepEqual(
    await ensureAnonymousActor(f.auth, {
      allowCreation: true,
      captchaToken: "test-token",
    }),
    { userId: id, anonymous: true, created: true },
  );
  assert.deepEqual(
    await ensureAnonymousActor(f.auth, { allowCreation: true }),
    { userId: id, anonymous: true, created: false },
  );
  assert.equal(f.count(), 1);
});
test("auth outages never silently replace an existing identity", async () => {
  const f = fixture(null);
  f.auth.getUser = async () => ({
    data: { user: null },
    error: { name: "AuthRetryableFetchError" },
  });
  await assert.rejects(
    ensureAnonymousActor(f.auth, {
      allowCreation: true,
      captchaToken: "test-token",
    }),
    /AUTH_LOOKUP_FAILED/,
  );
  assert.equal(f.count(), 0);
  f.auth.getUser = async () => {
    throw new Error("private token");
  };
  await assert.rejects(ensureAnonymousActor(f.auth, { allowCreation: true }), {
    message: "AUTH_LOOKUP_FAILED",
  });
});
test("provider errors are scrubbed and are not automatically retried", async () => {
  const f = fixture(null);
  let calls = 0;
  f.auth.signInAnonymously = async () => {
    calls++;
    throw new Error("private token");
  };
  await assert.rejects(
    ensureAnonymousActor(f.auth, {
      allowCreation: true,
      captchaToken: "test-token",
    }),
    { message: "ANONYMOUS_SIGN_IN_FAILED" },
  );
  assert.equal(calls, 1);
});
test("signup success alone is insufficient if verification reports a different user", async () => {
  const f = fixture(null);
  let reads = 0;
  f.auth.getUser = async () =>
    ++reads === 1
      ? { data: { user: null }, error: { name: "AuthSessionMissingError" } }
      : {
          data: {
            user: {
              id: "22222222-2222-4222-8222-222222222222",
              is_anonymous: true,
            },
          },
          error: null,
        };
  await assert.rejects(
    ensureAnonymousActor(f.auth, {
      allowCreation: true,
      captchaToken: "test-token",
    }),
    /ANONYMOUS_SESSION_UNVERIFIED/,
  );
  assert.equal(f.count(), 1);
});
