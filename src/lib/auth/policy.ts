export type LoginProvider = "google" | "kakao";
export type AuthUser = { id: string; is_anonymous?: boolean };
export type LoginFlow = { expectedUserId: string | null; expiresAt: number };
export const FLOW_COOKIE = "nook-login-flow";
export const FLOW_SECONDS = 600;

export function loginProvider(value: unknown): LoginProvider | null {
  return value === "google" || value === "kakao" ? value : null;
}

/** Use a deployment-owned origin, never a forwarded host or a return URL. */
export function siteOrigin(value: string | undefined): string {
  if (!value) throw new Error("Site URL is not configured");
  const url = new URL(value);
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (
    (url.protocol !== "https:" && !(local && url.protocol === "http:")) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error("Invalid site origin");
  return url.origin;
}

export function isSameOriginPost(request: Request, origin: string): boolean {
  return request.method === "POST" && request.headers.get("origin") === origin;
}

export function loginMode(
  user: AuthUser | null,
): "login" | "link" | "existing" {
  if (!user) return "login";
  return user.is_anonymous === true ? "link" : "existing";
}

export function readFlow(
  value: string | undefined,
  now = Date.now(),
): LoginFlow | null {
  try {
    if (!value || value.length > 300) return null;
    const flow: unknown = JSON.parse(value);
    if (!flow || typeof flow !== "object") return null;
    const { expectedUserId, expiresAt } = flow as LoginFlow;
    if (
      expectedUserId !== null &&
      (typeof expectedUserId !== "string" ||
        !/^[0-9a-f-]{36}$/i.test(expectedUserId))
    )
      return null;
    if (
      !Number.isSafeInteger(expiresAt) ||
      expiresAt <= now ||
      expiresAt > now + FLOW_SECONDS * 1000
    )
      return null;
    return { expectedUserId, expiresAt };
  } catch {
    return null;
  }
}

export function callbackMatches(
  flow: LoginFlow,
  user: AuthUser | null,
): boolean {
  return (
    !!user &&
    user.is_anonymous === false &&
    (flow.expectedUserId === null || flow.expectedUserId === user.id)
  );
}
