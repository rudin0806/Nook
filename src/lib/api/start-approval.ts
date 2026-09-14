import "server-only";
import {
  approveStartQuestion,
  readStartReceipt,
  type StartApprovalStore,
} from "@/engine/start-approval";
import { executeSafetyGate } from "@/engine/safety-gate";
import type { PrepareJudgeOptions } from "@/engine/judge";
import { createAdmissionContext } from "@/lib/api/ai-admission";
import { createOpenAIClient } from "@/lib/openai/server";

/** Internal authenticated entry point. Public routes and initial safe Message creation follow separately. */
export async function approveServerStartQuestion(
  input: { requestId: string; receipt: string; finalText: string },
  safetyOptions: PrepareJudgeOptions,
) {
  const { auth, admin, userId, secret, store } = await createAdmissionContext();
  const approvalStore: StartApprovalStore = {
    ...store,
    async terminate({
      receipt,
      requestId,
      token,
      fingerprint,
      finalText,
      safety,
    }) {
      const result = await admin.rpc("terminate_start_approval", {
        p_user: userId,
        p_request: requestId,
        p_token: token,
        p_fingerprint: fingerprint,
        p_session: receipt.sessionId,
        p_source: receipt.messageId,
        p_text: safety.behavior === "STOP" ? null : finalText,
        p_label: safety.label,
        p_category: safety.category,
        p_behavior: safety.behavior,
        p_expires_at: new Date(receipt.expiresAt).toISOString(),
      });
      if (result.error) throw new Error("APPROVAL_TERMINATION_FAILED");
      return result.data;
    },
    async readSource(receipt) {
      // Cookie client enforces RLS; never retrieve source text with the admin client.
      const session = await auth
        .from("thought_sessions")
        .select("id,status,storage_state,temporary_expires_at")
        .eq("id", receipt.sessionId)
        .eq("user_id", userId)
        .single();
      if (
        session.error ||
        session.data.status !== "ACTIVE" ||
        session.data.storage_state !== "TEMPORARY" ||
        Date.parse(session.data.temporary_expires_at) <= Date.now()
      )
        throw new Error("APPROVAL_SESSION_INVALID");
      const message = await auth
        .from("messages")
        .select("content")
        .eq("id", receipt.messageId)
        .eq("session_id", receipt.sessionId)
        .eq("role", "USER")
        .eq("kind", "RAW_THOUGHT")
        .single();
      if (message.error) throw new Error("APPROVAL_SOURCE_INVALID");
      return message.data.content;
    },
    async commit({ receipt, requestId, token, fingerprint, finalText }) {
      const result = await admin.rpc("approve_start_question", {
        p_user: userId,
        p_request: requestId,
        p_token: token,
        p_fingerprint: fingerprint,
        p_session: receipt.sessionId,
        p_message: receipt.messageId,
        p_proposed: receipt.question,
        p_final: finalText,
        p_expires_at: new Date(receipt.expiresAt).toISOString(),
      });
      if (result.error) throw new Error("APPROVAL_COMMIT_FAILED");
      return result.data;
    },
  };
  const result = await approveStartQuestion(
    { ...input, userId },
    secret,
    approvalStore,
    async (request) => {
      const result = await executeSafetyGate(request, safetyOptions, {
        moderate: (value) => createOpenAIClient().moderations.create(value),
        classify: (value) => createOpenAIClient().responses.create(value),
      });
      return { label: result.label, category: result.category };
    },
  );
  // A replay after an edited question triggered Safety references the Session, not a Node.
  if (
    result.status === "SUCCEEDED" &&
    result.result_id ===
      readStartReceipt(input.receipt, userId, secret).sessionId
  )
    return {
      status: "SAFETY_BLOCKED" as const,
      result_id: result.result_id,
      replayed: true,
    };
  return result;
}
