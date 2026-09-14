import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { claimSchema, type AdmissionStore } from "./admission.ts";
import { issueStartReceipt } from "./start-approval.ts";
import type { StartFlowResult } from "./start-flow.ts";

const ownerSchema = z.strictObject({
  userId: z.uuid(),
  sessionId: z.uuid(),
  messageId: z.uuid(),
  expiresAt: z.number().int().positive(),
});
const focusSchema = ownerSchema.extend({
  candidates: z.array(z.string().min(1).max(500)).min(2).max(10),
});
type Owner = z.infer<typeof ownerSchema>;
function sign(payload: string, secret: string) {
  if (secret.length < 32) throw new Error("START_NOT_CONFIGURED");
  return createHmac("sha256", secret)
    .update("nook:focus:v1:")
    .update(payload)
    .digest();
}
export function readFocusReceipt(
  token: string,
  userId: string,
  secret: string,
  now = Date.now(),
) {
  try {
    if (token.length > 32000) throw new Error();
    const [payload, mac, extra] = token.split(".");
    if (
      extra !== undefined ||
      !/^[A-Za-z0-9_-]+$/.test(payload) ||
      !/^[A-Za-z0-9_-]{43}$/.test(mac)
    )
      throw new Error();
    const expected = sign(payload, secret),
      actual = Buffer.from(mac, "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      throw new Error();
    const value = focusSchema.parse(
      JSON.parse(Buffer.from(payload, "base64url").toString("utf8")),
    );
    if (value.userId !== userId || value.expiresAt <= now) throw new Error();
    return value;
  } catch {
    throw new Error("FOCUS_RECEIPT_INVALID");
  }
}
export function proposalResponse(
  owner: Owner,
  result: StartFlowResult,
  secret: string,
) {
  ownerSchema.parse(owner);
  if (owner.expiresAt <= Date.now() || owner.expiresAt > Date.now() + 86400000)
    throw new Error("START_EXPIRED");
  if (result.kind === "PROPOSAL" || result.kind === "CLEAR_AS_IS")
    return { ...result, receipt: issueStartReceipt(owner, result, secret) };
  if (result.kind === "FOCUS_REQUIRED") {
    const value = focusSchema.parse({
      ...owner,
      candidates: result.candidates,
    });
    const payload = Buffer.from(JSON.stringify(value)).toString("base64url");
    return {
      ...result,
      receipt: `${payload}.${sign(payload, secret).toString("base64url")}`,
    };
  }
  return result;
}

/** Commit must atomically persist allowed input and complete this lease. No model retry on replay. */
export async function runStartRequest(
  input: {
    userId: string;
    requestId: string;
    operation: "start" | "focus";
    body: string;
  },
  secret: string,
  store: AdmissionStore,
  generate: () => Promise<StartFlowResult>,
  commit: (
    result: StartFlowResult,
    token: string,
    fingerprint: string,
  ) => Promise<Owner>,
) {
  z.uuid().parse(input.userId);
  z.uuid().parse(input.requestId);
  if (secret.length < 32) throw new Error("START_NOT_CONFIGURED");
  const fingerprint = createHmac("sha256", secret)
    .update(JSON.stringify([input.userId, input.operation, input.body]))
    .digest("hex");
  const claim = claimSchema.parse(
    await store.claim(input.userId, input.requestId, fingerprint),
  );
  if (claim.status !== "CLAIMED") return claim;
  try {
    const result = await generate();
    const owner = ownerSchema.parse(
      await commit(result, claim.token, fingerprint),
    );
    if (owner.userId !== input.userId) throw new Error("START_OWNER_INVALID");
    return {
      status: "SUCCEEDED" as const,
      result_id: owner.sessionId,
      result: proposalResponse(owner, result, secret),
    };
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
      /* lease expires; never replay models */
    }
    throw new Error("START_FAILED_OR_UNKNOWN");
  }
}
