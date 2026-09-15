import test from "node:test";
import assert from "node:assert/strict";
import { checkRelease } from "../src/lib/release/check.ts";
test("release checker uses only identity-free GET and checks all route contracts", async () => {
  const result = await checkRelease("https://nook.example", (async (
    url,
    init,
  ) => {
    assert.equal(init?.method, "GET");
    assert.equal(init?.credentials, "omit");
    assert.equal(init?.redirect, "manual");
    assert.equal(init?.body, undefined);
    const p = new URL(String(url)).pathname;
    const status =
      p === "/api/health" ? 200 : p === "/api/recovery" ? 401 : 400;
    return Response.json(
      status === 200
        ? { service: "nook", status: "ok" }
        : { error: { code: "REJECTED" } },
      { status, headers: { "cache-control": "no-store" } },
    );
  }) as typeof fetch);
  assert.equal(result.length, 4);
  assert.ok(result.every((r) => r.passed));
});
test("configuration failure and HTML fallback are never counted as release success", async () => {
  const unavailable = await checkRelease("https://nook.example", (async () =>
    Response.json(
      { error: { code: "SERVICE_NOT_CONFIGURED" } },
      { status: 503 },
    )) as typeof fetch);
  assert.ok(
    unavailable.every(
      (r) => !r.passed && r.reason === "configuration_unavailable",
    ),
  );
  const fallback = await checkRelease(
    "https://nook.example",
    (async () => new Response("private HTML")) as typeof fetch,
  );
  assert.ok(fallback.every((r) => !r.passed));
  assert.ok(!JSON.stringify(fallback).includes("private HTML"));
});
test("invalid origin makes no network request", async () => {
  for (const origin of [
    "http://public.example",
    "https://user:secret@nook.example",
    "https://nook.example/?token=x",
  ])
    await assert.rejects(
      () =>
        checkRelease(origin, async () => {
          throw new Error("must not call");
        }),
      /INVALID_RELEASE_ORIGIN/,
    );
});
