import assert from "node:assert/strict";
import test from "node:test";
import {
  loginProvider,
  providerLabel,
  siteOrigin,
  deploymentOrigin,
  isSameOriginPost,
  loginMode,
  readFlow,
  callbackMatches,
} from "../src/lib/auth/policy.ts";

test("only the two approved providers and deployment origins are allowed", () => {
  assert.equal(loginProvider("google"), "google");
  assert.equal(loginProvider("kakao"), "kakao");
  assert.equal(loginProvider("github"), null);
  assert.equal(siteOrigin("https://nook.example"), "https://nook.example");
  assert.equal(siteOrigin("http://localhost:3000"), "http://localhost:3000");
  for (const input of [
    undefined,
    "http://nook.example",
    "https://user@nook.example",
    "https://nook.example/path",
    "javascript:alert(1)",
  ])
    assert.throws(() => siteOrigin(input));
});
test("OAuth start and logout reject cross-origin, absent Origin and GET", () => {
  const origin = "https://nook.example";
  assert.ok(
    isSameOriginPost(
      new Request(origin, { method: "POST", headers: { origin } }),
      origin,
    ),
  );
  for (const request of [
    new Request(origin),
    new Request(origin, { method: "POST" }),
    new Request(origin, {
      method: "POST",
      headers: { origin: "https://evil.example" },
    }),
  ])
    assert.equal(isSameOriginPost(request, origin), false);
});
test("anonymous identity is linked while permanent users keep their session", () => {
  assert.equal(loginMode(null), "login");
  assert.equal(loginMode({ id: "one", is_anonymous: true }), "link");
  assert.equal(loginMode({ id: "one", is_anonymous: false }), "existing");
});
test("callback rejects expired or malformed flow and different or anonymous identity", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  const flow = { expectedUserId: id, expiresAt: 2000 };
  assert.deepEqual(readFlow(JSON.stringify(flow), 1000), flow);
  assert.equal(readFlow(JSON.stringify(flow), 2000), null);
  for (const input of [
    undefined,
    "{}",
    "null",
    "no",
    JSON.stringify({ ...flow, expiresAt: 99999999 }),
  ])
    assert.equal(readFlow(input, 1000), null);
  assert.ok(callbackMatches(flow, { id, is_anonymous: false }));
  assert.equal(
    callbackMatches(flow, { id: "different", is_anonymous: false }),
    false,
  );
  assert.equal(callbackMatches(flow, { id, is_anonymous: true }), false);
  assert.equal(callbackMatches(flow, null), false);
  assert.ok(
    callbackMatches(
      { ...flow, expectedUserId: null },
      { id, is_anonymous: false },
    ),
  );
});

const { startLogin } = await import("../src/lib/auth/start.ts");
test("OAuth orchestration preserves anonymous identity and never falls back on linking error", async () => {
  const calls: string[] = [];
  const auth = {
    async getUser() {
      return {
        data: { user: { id: "anonymous-id", is_anonymous: true } },
        error: null,
      };
    },
    async linkIdentity(input: { options: { redirectTo: string } }) {
      calls.push("link");
      assert.equal(
        input.options.redirectTo,
        "https://nook.example/api/auth/callback",
      );
      return {
        data: { url: null },
        error: { message: "identity already belongs to someone" },
      };
    },
    async signInWithOAuth() {
      calls.push("login");
      return { data: { url: "https://provider.example" }, error: null };
    },
  };
  assert.deepEqual(await startLogin(auth, "google", "https://nook.example"), {
    kind: "error",
    reason: "start",
  });
  assert.deepEqual(calls, ["link"]);
});
test("ordinary login, existing login and auth failure take distinct paths", async () => {
  let calls = 0;
  const auth = {
    async getUser(): Promise<{
      data: { user: { id: string; is_anonymous: boolean } | null };
      error: { name: string } | null;
    }> {
      return {
        data: { user: null },
        error: { name: "AuthSessionMissingError" },
      };
    },
    async linkIdentity() {
      throw new Error("must not link");
    },
    async signInWithOAuth() {
      calls++;
      return { data: { url: "https://provider.example" }, error: null };
    },
  };
  assert.deepEqual(await startLogin(auth, "kakao", "https://nook.example"), {
    kind: "redirect",
    url: "https://provider.example",
    expectedUserId: null,
  });
  auth.getUser = async () => ({
    data: { user: { id: "one", is_anonymous: false } },
    error: null,
  });
  assert.deepEqual(await startLogin(auth, "google", "https://nook.example"), {
    kind: "existing",
  });
  auth.getUser = async () => ({
    data: { user: null },
    error: { name: "AuthRetryableFetchError" },
  });
  assert.deepEqual(await startLogin(auth, "google", "https://nook.example"), {
    kind: "error",
    reason: "session",
  });
  assert.equal(calls, 1);
});

test("preview uses its own deployment while production and local require configured origin", () => {
  const env = {
    NOOK_SITE_URL: "https://nook.example",
    VERCEL_URL: "nook-build-team.vercel.app",
  };
  const preview = deploymentOrigin({ ...env, VERCEL_ENV: "preview" });
  assert.equal(preview, "https://nook-build-team.vercel.app");
  for (const VERCEL_ENV of [undefined, "production", "development"])
    assert.equal(deploymentOrigin({ ...env, VERCEL_ENV }), env.NOOK_SITE_URL);
  assert.throws(() =>
    deploymentOrigin({ VERCEL_ENV: "production", VERCEL_URL: env.VERCEL_URL }),
  );
  for (const VERCEL_URL of [
    undefined,
    "",
    "evil.example",
    "nook.vercel.app.evil.example",
    "user@nook.vercel.app",
    "nook.vercel.app/path",
    "nook.vercel.app:443",
    "https://nook.vercel.app",
  ])
    assert.throws(() =>
      deploymentOrigin({ ...env, VERCEL_ENV: "preview", VERCEL_URL }),
    );
  assert.ok(
    isSameOriginPost(
      new Request(preview, { method: "POST", headers: { origin: preview } }),
      preview,
    ),
  );
  assert.equal(
    isSameOriginPost(
      new Request(preview, {
        method: "POST",
        headers: {
          origin: env.NOOK_SITE_URL,
          "x-forwarded-host": env.VERCEL_URL,
        },
      }),
      preview,
    ),
    false,
  );
});

test("제공자 이름을 화면 말로 돌려준다", () => {
  // 이 이름을 아는 곳이 화면마다 따로 있으면 하나만 고쳐진 채로 갈라진다.
  assert.equal(providerLabel("google"), "Google");
  assert.equal(providerLabel("kakao"), "카카오");
  // 모르는 값은 지어내지 않고 그대로 돌려준다. 빈 값과 값 아닌 것은 없는 것이다.
  assert.equal(providerLabel("apple"), "apple");
  assert.equal(providerLabel(null), null);
  assert.equal(providerLabel(""), null);
  assert.equal(providerLabel(undefined), null);
  assert.equal(providerLabel(7), null);
});

test("로그인에 쓸 수 있는 제공자는 둘뿐이다", () => {
  assert.equal(loginProvider("kakao"), "kakao");
  assert.equal(loginProvider("google"), "google");
  for (const bad of ["apple", "naver", "", null, undefined, 1])
    assert.equal(loginProvider(bad), null);
});
