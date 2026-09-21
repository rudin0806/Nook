import assert from "node:assert/strict";
import test from "node:test";
import { captchaSubmissionBlocked } from "../src/lib/auth/captcha-gate.ts";

test("anonymous submission stays blocked until the challenge has a token", () => {
  assert.equal(captchaSubmissionBlocked("checking", ""), true);
  assert.equal(captchaSubmissionBlocked("required", ""), true);
  assert.equal(captchaSubmissionBlocked("unavailable", ""), true);
  assert.equal(captchaSubmissionBlocked("required", "captcha-token"), false);
});

test("an authenticated session does not need a CAPTCHA token", () => {
  assert.equal(captchaSubmissionBlocked("not-required", ""), false);
});
