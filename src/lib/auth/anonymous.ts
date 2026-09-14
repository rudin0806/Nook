import { z } from "zod";

const actorSchema = z.object({ id: z.uuid(), is_anonymous: z.boolean() });
type Actor = z.infer<typeof actorSchema>;
type AuthResult = { data: { user: unknown }; error: { name: string } | null };
export type AnonymousAuth = {
  getUser(): Promise<AuthResult>;
  signInAnonymously(input: {
    options: { captchaToken: string };
  }): Promise<AuthResult>;
};
export type AnonymousBootstrapResult = {
  userId: string;
  anonymous: boolean;
  created: boolean;
};

function result(actor: Actor, created: boolean): AnonymousBootstrapResult {
  return { userId: actor.id, anonymous: actor.is_anonymous, created };
}

/** Internal server orchestration; never accept the enable flag from a request. */
export async function ensureAnonymousActor(
  auth: AnonymousAuth,
  options: { allowCreation: boolean; captchaToken?: unknown },
): Promise<AnonymousBootstrapResult> {
  let current: AuthResult;
  try {
    current = await auth.getUser();
  } catch {
    throw new Error("AUTH_LOOKUP_FAILED");
  }
  if (current.error && current.error.name !== "AuthSessionMissingError")
    throw new Error("AUTH_LOOKUP_FAILED");
  if (current.data.user) {
    if (current.error) throw new Error("AUTH_LOOKUP_FAILED");
    const actor = actorSchema.safeParse(current.data.user);
    if (!actor.success) throw new Error("AUTH_USER_INVALID");
    return result(actor.data, false);
  }
  if (!options.allowCreation) throw new Error("ANONYMOUS_CREATION_DISABLED");
  // The provider must have CAPTCHA enforcement enabled. Presence is not verification.
  const token = z
    .string()
    .trim()
    .min(1)
    .max(4096)
    .safeParse(options.captchaToken);
  if (!token.success) throw new Error("CAPTCHA_REQUIRED");
  let signedIn: AuthResult;
  try {
    signedIn = await auth.signInAnonymously({
      options: { captchaToken: token.data },
    });
  } catch {
    throw new Error("ANONYMOUS_SIGN_IN_FAILED");
  }
  if (signedIn.error) throw new Error("ANONYMOUS_SIGN_IN_FAILED");
  const created = actorSchema.safeParse(signedIn.data.user);
  if (!created.success || !created.data.is_anonymous)
    throw new Error("ANONYMOUS_USER_INVALID");
  let verified: AuthResult;
  try {
    verified = await auth.getUser();
  } catch {
    throw new Error("ANONYMOUS_SESSION_UNVERIFIED");
  }
  const actor = actorSchema.safeParse(verified.data.user);
  if (
    verified.error ||
    !actor.success ||
    actor.data.id !== created.data.id ||
    !actor.data.is_anonymous
  )
    throw new Error("ANONYMOUS_SESSION_UNVERIFIED");
  return result(actor.data, true);
}
