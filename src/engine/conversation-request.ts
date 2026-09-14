import { createHmac } from "node:crypto";
import { claimSchema, type AdmissionStore } from "./admission.ts";
import {
  conversationRequestSchema,
  type ConversationRequest,
  type ConversationSnapshot,
} from "../schemas/conversation.ts";
import { mapSafety } from "./safety.ts";
export type ConversationDependencies = {
  store: AdmissionStore;
  load: () => Promise<ConversationSnapshot>;
  replay: () => Promise<unknown>;
  safety: (
    text: string,
    snapshot: ConversationSnapshot,
  ) => Promise<ReturnType<typeof mapSafety>>;
  commit: (
    phase: string,
    text: string | null,
    payload: unknown,
    version: number,
    token: string,
    fingerprint: string,
  ) => Promise<{ version: number; mode?: string }>;
  generate: (snapshot: ConversationSnapshot) => Promise<unknown>;
};
export async function runConversationRequest(
  raw: ConversationRequest,
  userId: string,
  secret: string,
  d: ConversationDependencies,
) {
  const input = conversationRequestSchema.parse(raw);
  if (secret.length < 32) throw new Error("CONVERSATION_NOT_CONFIGURED");
  const fingerprint = createHmac("sha256", secret)
    .update(JSON.stringify([userId, "conversation", input]))
    .digest("hex");
  const claim = claimSchema.parse(
    await d.store.claim(userId, input.requestId, fingerprint),
  );
  if (claim.status === "SUCCEEDED")
    return { status: "SUCCEEDED" as const, result: await d.replay() };
  if (claim.status !== "CLAIMED") return claim;
  try {
    const s = await d.load();
    if (s.session.status !== "ACTIVE" || s.state.version !== input.version)
      throw new Error("CONVERSATION_VERSION_CONFLICT");
    if (
      input.action === "reply" &&
      (s.state.mode !== "READY" ||
        s.segment.node_count >= 4 ||
        s.segment.turn_count >= 20)
    )
      throw new Error("CONVERSATION_REPLY_BLOCKED");
    if (
      ["approve", "reject"].includes(input.action) &&
      s.state.mode !== "SHIFT"
    )
      throw new Error("CONVERSATION_PROPOSAL_INVALID");
    if (
      input.action === "continue" &&
      !["CLOSE", "STRUCTURAL"].includes(s.state.mode)
    )
      throw new Error("CONVERSATION_CONTINUE_INVALID");
    if (input.text) {
      const safety = await d.safety(input.text, s);
      if (safety.behavior !== "CONTINUE") {
        const result = await d.commit(
          "safety",
          safety.behavior === "STOP" ? null : input.text,
          safety,
          s.state.version,
          claim.token,
          fingerprint,
        );
        return {
          status: "SUCCEEDED" as const,
          result: { ...result, label: safety.label, category: safety.category },
        };
      }
    }
    if (input.action === "reply") {
      await d.commit(
        "input",
        input.text!,
        {},
        s.state.version,
        claim.token,
        fingerprint,
      );
      // A safe USER message is durable before Judge; invalid model output never becomes a Node.
      const updated = await d.load();
      const plan = await d.generate(updated);
      const result = await d.commit(
        "output",
        null,
        plan,
        updated.state.version,
        claim.token,
        fingerprint,
      );
      return { status: "SUCCEEDED" as const, result };
    }
    const result = await d.commit(
      input.action,
      input.text ?? null,
      {},
      s.state.version,
      claim.token,
      fingerprint,
    );
    return { status: "SUCCEEDED" as const, result };
  } catch {
    try {
      await d.store.finish(userId, input.requestId, claim.token, false, null);
    } catch {
      /* Preserve uncertain lease; never replay paid work. */
    }
    throw new Error("CONVERSATION_FAILED_OR_UNKNOWN");
  }
}
