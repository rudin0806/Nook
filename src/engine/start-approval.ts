import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { rawThoughtSchema, nodeZeroOutputSchema } from "../schemas/start.ts";
import { claimSchema, type AdmissionStore } from "./admission.ts";
import { mapSafety } from "./safety.ts";
import type { StartFlowResult } from "./start-flow.ts";

const uuid = z.string().uuid();
const receiptSchema = z.strictObject({
  version: z.literal(1),
  userId: uuid,
  sessionId: uuid,
  messageId: uuid,
  expiresAt: z.number().int().positive(),
  question: rawThoughtSchema,
});
export type StartReceipt = z.infer<typeof receiptSchema>;
function signature(payload: string, secret: string) {
  if (secret.length < 32) throw new Error("APPROVAL_NOT_CONFIGURED");
  return createHmac("sha256", secret)
    .update("nook:start-approval:v1:")
    .update(payload)
    .digest();
}

/** Trusted server only: result must come from the completed Safety/start coordinator.
 * The receipt is signed, NOT encrypted. Never log it or put it in a URL/localStorage.
 * It avoids persisting an unapproved Node or candidate in the database.
 */
export function issueStartReceipt(
  owner: Omit<StartReceipt, "version" | "question">,
  result: StartFlowResult,
  secret: string,
  now = Date.now(),
) {
  const question =
    result.kind === "PROPOSAL"
      ? nodeZeroOutputSchema.parse(result.proposal).question
      : result.kind === "CLEAR_AS_IS"
        ? rawThoughtSchema.parse(result.question)
        : null;
  if (question === null) throw new Error("APPROVAL_NO_PROPOSAL");
  const receipt = receiptSchema.parse({ ...owner, version: 1, question });
  if (receipt.expiresAt <= now || receipt.expiresAt > now + 86_400_000)
    throw new Error("APPROVAL_EXPIRY_INVALID");
  const payload = Buffer.from(JSON.stringify(receipt)).toString("base64url");
  return `${payload}.${signature(payload, secret).toString("base64url")}`;
}

export function readStartReceipt(
  token: string,
  userId: string,
  secret: string,
  now = Date.now(),
): StartReceipt {
  try {
    if (token.length > 32_000) throw new Error();
    const parts = token.split(".");
    if (
      parts.length !== 2 ||
      !/^[A-Za-z0-9_-]+$/.test(parts[0]) ||
      !/^[A-Za-z0-9_-]{43}$/.test(parts[1])
    )
      throw new Error();
    const expected = signature(parts[0], secret);
    const actual = Buffer.from(parts[1], "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      throw new Error();
    const receipt = receiptSchema.parse(
      JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")),
    );
    if (receipt.userId !== uuid.parse(userId) || receipt.expiresAt <= now)
      throw new Error();
    return receipt;
  } catch {
    throw new Error("APPROVAL_RECEIPT_INVALID");
  }
}

export interface StartApprovalStore extends AdmissionStore {
  /** Ownership/state check before any paid edit Safety call. Commit repeats it under lock. */
  readSource(receipt: StartReceipt): Promise<string>;
  /** Must atomically insert Node + increment counter + finish request, not separate writes. */
  commit(input: {
    receipt: StartReceipt;
    requestId: string;
    token: string;
    fingerprint: string;
    finalText: string;
  }): Promise<unknown>;
}

export async function approveStartQuestion(
  input: {
    userId: string;
    requestId: string;
    receipt: string;
    finalText: string;
  },
  secret: string,
  store: StartApprovalStore,
  safetyGate: (input: {
    context: string[];
    utterance: string;
  }) => Promise<unknown>,
) {
  const receipt = readStartReceipt(input.receipt, input.userId, secret);
  const requestId = uuid.parse(input.requestId);
  const finalText = rawThoughtSchema.parse(input.finalText);
  const fingerprint = createHmac("sha256", secret)
    .update(
      JSON.stringify([input.userId, "approve_start", input.receipt, finalText]),
    )
    .digest("hex");
  let claim;
  try {
    claim = claimSchema.parse(
      await store.claim(input.userId, requestId, fingerprint),
    );
  } catch {
    throw new Error("ADMISSION_UNAVAILABLE");
  }
  // Replays never repeat Safety or database writes.
  if (claim.status !== "CLAIMED") return claim;
  try {
    const source = rawThoughtSchema.parse(await store.readSource(receipt));
    if (finalText !== receipt.question) {
      const safety = mapSafety(
        await safetyGate({ context: [source], utterance: finalText }),
      );
      if (safety.behavior !== "CONTINUE") {
        await store.finish(input.userId, requestId, claim.token, false, null);
        // Caller must enter the existing STOP/HANDOFF flow; no Node or edited text is saved here.
        return { status: "SAFETY_BLOCKED" as const, safety };
      }
    }
    const nodeId = uuid.parse(
      await store.commit({
        receipt,
        requestId,
        token: claim.token,
        fingerprint,
        finalText,
      }),
    );
    return { status: "SUCCEEDED" as const, result_id: nodeId };
  } catch {
    // If the commit response was lost, SUCCEEDED cannot be changed to FAILED by finish.
    // Never retry the operation automatically; replay the SAME request ID to resolve it.
    try {
      await store.finish(input.userId, requestId, claim.token, false, null);
    } catch {
      /* lease expires */
    }
    throw new Error("APPROVAL_FAILED_OR_UNKNOWN");
  }
}
