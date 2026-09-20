import { loginMode, type AuthUser, type LoginProvider } from "./policy.ts";

type OAuthRequest = {
  provider: LoginProvider;
  options: {
    redirectTo: string;
    skipBrowserRedirect: boolean;
    scopes?: string;
  };
};
type OAuthResult = { data: { url: string | null }; error: unknown };
export type LoginAuth = {
  getUser(): Promise<{
    data: { user: AuthUser | null };
    error: { name: string } | null;
  }>;
  linkIdentity(request: OAuthRequest): Promise<OAuthResult>;
  signInWithOAuth(request: OAuthRequest): Promise<OAuthResult>;
};
export type LoginStart =
  | { kind: "existing" }
  | { kind: "error"; reason: "session" | "start" }
  | { kind: "redirect"; url: string; expectedUserId: string | null };

/** 제공자에게 실제로 요청할 범위.
 *
 * 값을 주지 않으면 Supabase가 제 기본값을 쓴다. 카카오의 기본값은
 * `account_email profile_image profile_nickname`인데, 그중 프로필 사진은 이
 * 제품이 어디에도 쓰지 않고 이메일은 카카오 비즈니스 앱으로 전환해야 동의항목에
 * 설정할 수 있다. 설정되지 않은 항목을 요청하면 카카오는 로그인 화면 대신
 * KOE205를 돌려준다 — 쓰지도 않을 항목 때문에 로그인 자체가 막힌다.
 *
 * 그래서 쓰는 것만 요청한다. 닉네임은 일반 앱에서도 설정할 수 있다. 구글은
 * Supabase 기본값이 그대로 맞아서 손대지 않는다. */
function scopesFor(provider: LoginProvider) {
  return provider === "kakao" ? "profile_nickname" : undefined;
}

export async function startLogin(
  auth: LoginAuth,
  provider: LoginProvider,
  origin: string,
): Promise<LoginStart> {
  const { data, error } = await auth.getUser();
  if (error && error.name !== "AuthSessionMissingError")
    return { kind: "error", reason: "session" };
  const mode = loginMode(data.user);
  if (mode === "existing") return { kind: "existing" };
  const scopes = scopesFor(provider);
  const request = {
    provider,
    options: {
      redirectTo: `${origin}/api/auth/callback`,
      skipBrowserRedirect: true,
      ...(scopes ? { scopes } : {}),
    },
  };
  const result =
    mode === "link"
      ? await auth.linkIdentity(request)
      : await auth.signInWithOAuth(request);
  // Linking errors never fall back to ordinary login, which would change user ID.
  if (result.error || !result.data.url)
    return { kind: "error", reason: "start" };
  return {
    kind: "redirect",
    url: result.data.url,
    expectedUserId: mode === "link" ? data.user!.id : null,
  };
}
