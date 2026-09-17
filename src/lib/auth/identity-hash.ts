import { createHmac } from "node:crypto";

// Not marked server-only so it stays unit-testable: the key is an argument
// rather than read from the environment here, and node:crypto would fail to
// bundle for a client component anyway.

/** Refusing a withdrawn sign-in method needs something that identifies it, and
 * nothing readable may be kept. This is an HMAC of the provider's own subject
 * under a server-only key, with a purpose label so the same key used elsewhere
 * cannot produce the same digest. Without the key the digest cannot be matched
 * against a guessed account, and it is never reversible into one.
 */
export type ProviderIdentity = {
  provider?: string | null;
  /** The provider's stable subject for this account, not the email. */
  identity_data?: { sub?: unknown } | null;
};

export function identityHash(
  identity: ProviderIdentity | undefined,
  secret: string | undefined,
): string | null {
  if (!secret || secret.length < 32) return null;
  const provider = identity?.provider;
  const subject = identity?.identity_data?.sub;
  if (typeof provider !== "string" || !provider) return null;
  if (typeof subject !== "string" || !subject) return null;
  return createHmac("sha256", secret)
    .update(`nook:rejoin-block:v1:${provider}:${subject}`)
    .digest("hex");
}

/** Anonymous visitors have no provider identity, so there is nothing to block. */
export function firstProviderIdentity(
  identities: ProviderIdentity[] | null | undefined,
): ProviderIdentity | undefined {
  return (identities ?? []).find(
    (identity) =>
      typeof identity.provider === "string" &&
      identity.provider !== "anonymous",
  );
}
