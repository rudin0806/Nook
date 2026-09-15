import type { LoginFlow } from "./policy.ts";

export type CallbackFailure =
  | "cancelled"
  | "provider"
  | "expired"
  | "callback"
  | "exchange"
  | "session"
  | "identity";

/** Classify only; never copy external messages/codes into redirects or logs. */
export function callbackInputFailure(
  params: URLSearchParams,
  flow: LoginFlow | null,
): CallbackFailure | null {
  if (params.has("error"))
    return params.get("error") === "access_denied" ? "cancelled" : "provider";
  if (!flow) return "expired";
  const code = params.get("code");
  if (!code || code.length > 4096) return "callback";
  return null;
}

export function callbackFailurePath(reason: CallbackFailure): string {
  // An explicit empty fragment prevents inheriting the provider's fragment.
  return `/login?error=${reason}#`;
}
