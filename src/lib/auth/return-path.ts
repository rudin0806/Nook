export const RETURN_COOKIE = "nook-login-return";
/** Deliberate allowlist: no external URLs, fragments, or arbitrary app routes. */
export function authReturnPath(value: unknown): string {
  return typeof value === "string" &&
    /^\/resume\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\?retention=1$/i.test(
      value,
    )
    ? value
    : "/drawer";
}
function authPath(base: string, returnTo: string, error?: string): string {
  const params = new URLSearchParams();
  if (error) params.set("error", error);
  const safe = authReturnPath(returnTo);
  if (safe !== "/drawer") params.set("returnTo", safe);
  return `${base}${params.size ? `?${params}` : ""}${error ? "#" : ""}`;
}

export function loginPath(returnTo: string, error?: string): string {
  return authPath("/login", returnTo, error);
}

/** 동의를 받는 쪽은 가입 화면이다. 동의가 모자라 되돌아온 사람을 로그인으로
 *  보내면 체크박스가 없는 화면에 세워 두게 된다. */
export function signupPath(returnTo: string, error?: string): string {
  return authPath("/signup", returnTo, error);
}
