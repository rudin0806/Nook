export type CaptchaGateState =
  "checking" | "not-required" | "required" | "unavailable";

/** Anonymous creation must fail closed until Auth says CAPTCHA is unnecessary
 * or the visitor has completed the challenge. */
export function captchaSubmissionBlocked(
  state: CaptchaGateState,
  token: string,
) {
  return state !== "not-required" && token.length === 0;
}
