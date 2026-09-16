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
export function loginPath(returnTo: string, error?: string): string {
  const params = new URLSearchParams();
  if (error) params.set("error", error);
  const safe = authReturnPath(returnTo);
  if (safe !== "/drawer") params.set("returnTo", safe);
  return `/login${params.size ? `?${params}` : ""}${error ? "#" : ""}`;
}
