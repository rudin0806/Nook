import assert from "node:assert/strict";
import test from "node:test";
import {
  captchaScriptSource,
  captchaSubmissionBlocked,
  captchaWidgetTheme,
} from "../src/lib/auth/captcha-gate.ts";

test("anonymous submission stays blocked until the challenge has a token", () => {
  assert.equal(captchaSubmissionBlocked("checking", ""), true);
  assert.equal(captchaSubmissionBlocked("required", ""), true);
  assert.equal(captchaSubmissionBlocked("unavailable", ""), true);
  assert.equal(captchaSubmissionBlocked("required", "captcha-token"), false);
});

test("an authenticated session does not need a CAPTCHA token", () => {
  assert.equal(captchaSubmissionBlocked("not-required", ""), false);
});

test("hCaptcha waits for its SDK callback and uses a supported theme", () => {
  assert.equal(
    captchaScriptSource("hcaptcha"),
    "https://js.hcaptcha.com/1/api.js?onload=nookHcaptchaReady&render=explicit",
  );
  assert.equal(captchaWidgetTheme("hcaptcha", false), "light");
  assert.equal(captchaWidgetTheme("hcaptcha", true), "dark");
});

test("Turnstile keeps explicit rendering and automatic theming", () => {
  assert.equal(
    captchaScriptSource("turnstile"),
    "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit",
  );
  assert.equal(captchaWidgetTheme("turnstile", false), "auto");
  assert.equal(captchaWidgetTheme("turnstile", true), "auto");
});
