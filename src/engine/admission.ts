import { createHmac } from "node:crypto";
import { z } from "zod";

const uuid = z.string().uuid();
export const claimSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("CLAIMED"), token: uuid }),
  z.object({
    status: z.enum(["RUNNING", "SUCCEEDED", "FAILED"]),
    result_id: uuid.nullable(),
  }),
  z.object({ status: z.literal("CONFLICT") }),
  z.object({
    status: z.enum(["BUSY", "RATE_LIMITED"]),
    retry_after: z.number().int().positive(),
  }),
]);
export type Claim = z.infer<typeof claimSchema>;
export interface AdmissionStore {
  claim(
    userId: string,
    requestId: string,
    fingerprint: string,
  ): Promise<unknown>;
  finish(
    userId: string,
    requestId: string,
    token: string,
    success: boolean,
    resultId: string | null,
  ): Promise<boolean>;
}
/** Caller must obtain userId from verified authentication, never from request JSON.
 * body is the exact validated payload; include operation/session/turn identifiers in it.
 * HMAC secret must be stable, server-only and independent of API credentials.
 */
export async function runAdmittedRequest(
  input: { userId: string; requestId: string; operation: string; body: string },
  secret: string,
  store: AdmissionStore,
  operation: () => Promise<string | null>,
): Promise<Claim> {
  uuid.parse(input.userId);
  uuid.parse(input.requestId);
  if (
    secret.length < 32 ||
    !/^[a-z][a-z0-9_-]{0,39}$/.test(input.operation) ||
    input.body.length > 100_000
  )
    throw new Error("ADMISSION_INPUT_INVALID");
  const fingerprint = createHmac("sha256", secret)
    .update(JSON.stringify([input.userId, input.operation, input.body]))
    .digest("hex");
  let claim: Claim;
  try {
    claim = claimSchema.parse(
      await store.claim(input.userId, input.requestId, fingerprint),
    );
  } catch {
    throw new Error("ADMISSION_UNAVAILABLE");
  }
  if (claim.status !== "CLAIMED") return claim;
  let result: string | null;
  try {
    result = await operation();
    uuid.nullable().parse(result);
  } catch {
    try {
      await store.finish(
        input.userId,
        input.requestId,
        claim.token,
        false,
        null,
      );
    } catch {
      /* remain RUNNING until expiry; never retry AI */
    }
    throw new Error("AI_OPERATION_FAILED");
  }
  let finished = false;
  try {
    finished = await store.finish(
      input.userId,
      input.requestId,
      claim.token,
      true,
      result,
    );
  } catch {
    /* outcome unknown, do not retry operation */
  }
  if (!finished) throw new Error("ADMISSION_COMPLETION_UNKNOWN");
  return { status: "SUCCEEDED", result_id: result };
}
