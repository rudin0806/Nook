import { loginMode, type AuthUser, type LoginProvider } from "./policy.ts";

type OAuthRequest = {
  provider: LoginProvider;
  options: {
    redirectTo: string;
    skipBrowserRedirect: boolean;
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
  const request = {
    provider,
    options: {
      redirectTo: `${origin}/api/auth/callback`,
      skipBrowserRedirect: true,
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
