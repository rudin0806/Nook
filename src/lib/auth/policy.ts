import { authReturnPath } from "./return-path.ts";
export type LoginProvider = "google" | "kakao";
export type AuthUser = { id: string; is_anonymous?: boolean };
export type LoginFlow = {
  expectedUserId: string | null;
  expiresAt: number;
  returnTo?: string;
  /** Set only when the sign-in screen collected the required agreements, so the
   * callback records consent for a member who actually ticked them. */
  agreed?: boolean;
};
export const FLOW_COOKIE = "nook-login-flow";
export const FLOW_SECONDS = 600;

export function loginProvider(value: unknown): LoginProvider | null {
  return value === "google" || value === "kakao" ? value : null;
}

/** 화면에 쓰는 제공자 이름. 전에는 `내 정보`가 google만 알고 나머지는 받은 값을
 *  그대로 썼다 — 카카오로 들어오면 `kakao로 연결됨`이라는 영어가 나왔다. 이름을
 *  아는 곳을 한 군데로 둔다. */
export function providerLabel(value: unknown): string | null {
  if (value === "google") return "Google";
  if (value === "kakao") return "카카오";
  return typeof value === "string" && value ? value : null;
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
    if (!value || value.length > 500) return null;
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
    const { returnTo, agreed } = flow as LoginFlow;
    return {
      expectedUserId,
      expiresAt,
      ...(returnTo === undefined ? {} : { returnTo: authReturnPath(returnTo) }),
      ...(agreed === true ? { agreed: true } : {}),
    };
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

export type DeploymentEnvironment = {
  NOOK_SITE_URL?: string;
  VERCEL_ENV?: string;
  VERCEL_URL?: string;
};

/** Only trusted server environment values; never infer trust from request headers. */
export function deploymentOrigin(environment: DeploymentEnvironment): string {
  if (environment.VERCEL_ENV === "preview") {
    const host = environment.VERCEL_URL;
    if (
      !host ||
      !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.vercel\.app$/.test(host)
    )
      throw new Error("Invalid preview deployment host");
    return siteOrigin(`https://${host}`);
  }
  return siteOrigin(environment.NOOK_SITE_URL);
}
