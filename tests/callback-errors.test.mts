import assert from "node:assert/strict";
import test from "node:test";
import { NextResponse } from "next/server.js";
import {
  callbackInputFailure,
  callbackFailurePath,
} from "../src/lib/auth/callback-errors.ts";
const flow = { expectedUserId: null, expiresAt: 1000 };
test("external errors take precedence and never become public raw errors", () => {
  for (const error of ["server_error", "unexpected_failure", "<script>"]) {
    const p = new URLSearchParams({
      error,
      error_description: "secret-code",
      code: "secret-code",
    });
    assert.equal(callbackInputFailure(p, null), "provider");
  }
  assert.equal(
    callbackInputFailure(new URLSearchParams("error=access_denied"), flow),
    "cancelled",
  );
});
test("missing flow and invalid codes cannot reach session exchange", () => {
  assert.equal(
    callbackInputFailure(new URLSearchParams("code=valid"), null),
    "expired",
  );
  for (const code of ["", "a".repeat(4097)])
    assert.equal(
      callbackInputFailure(new URLSearchParams({ code }), flow),
      "callback",
    );
  assert.equal(
    callbackInputFailure(new URLSearchParams("code=valid"), flow),
    null,
  );
});
test("Next redirect retains explicit empty fragment and only fixed failure reason", () => {
  const url = new URL(callbackFailurePath("provider"), "https://nook.example");
  const response = NextResponse.redirect(url, 303);
  assert.equal(
    response.headers.get("location"),
    "https://nook.example/login?error=provider#",
  );
});
