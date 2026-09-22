export type CaptchaGateState =
  "checking" | "not-required" | "required" | "unavailable";

export type CaptchaProvider = "hcaptcha" | "turnstile";

export const HCAPTCHA_ONLOAD_CALLBACK = "nookHcaptchaReady";

/** hCaptcha finishes setup after the script load event, so its documented
 * onload callback must gate explicit rendering. */
export function captchaScriptSource(provider: CaptchaProvider) {
  return provider === "hcaptcha"
    ? `https://js.hcaptcha.com/1/api.js?onload=${HCAPTCHA_ONLOAD_CALLBACK}&render=explicit`
    : "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
}

/** Turnstile supports `auto`; hCaptcha accepts only concrete light/dark themes. */
export function captchaWidgetTheme(
  provider: CaptchaProvider,
  dark: boolean,
): "auto" | "light" | "dark" {
  if (provider === "turnstile") return "auto";
  return dark ? "dark" : "light";
}

/** Anonymous creation must fail closed until Auth says CAPTCHA is unnecessary
 * or the visitor has completed the challenge. */
export function captchaSubmissionBlocked(
  state: CaptchaGateState,
  token: string,
) {
  return state !== "not-required" && token.length === 0;
}
