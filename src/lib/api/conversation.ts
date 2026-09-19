import "server-only";
import { createAdmissionContext } from "./ai-admission";
import { createStageTimer } from "./stage-timing";
import { loadConversation } from "./conversation-context";
import { runConversationRequest } from "@/engine/conversation-request";
import { planConversationTurn } from "@/engine/conversation";
import { executeSafetyGate } from "@/engine/safety-gate";
import { createOpenAIClient } from "@/lib/openai/server";
import { getConversationEnvironment } from "@/lib/env/server";
import type { ConversationRequest } from "@/schemas/conversation";

export async function converse(input: ConversationRequest) {
  const ctx = await createAdmissionContext();
  let sessionId: string | undefined;

  const stage = createStageTimer(ctx.admin);

  const load = async () =>
    stage("LOAD", null, async () => {
      const s = await loadConversation(ctx.auth, input.nodeId);
      sessionId = s.session.id;
      return s;
    });
  return runConversationRequest(input, ctx.userId, ctx.secret, {
    store: ctx.store,
    load,
    replay: async () => {
      const result = await ctx.admin
        .from("conversation_receipts")
        .select("result")
        .eq("user_id", ctx.userId)
        .eq("request_id", input.requestId)
        .single();
      if (result.error) throw new Error("CONVERSATION_REPLAY_UNAVAILABLE");
      return result.data.result;
    },
    safety: (text, s) =>
      stage("SAFETY", getConversationEnvironment().safety.model, () =>
        executeSafetyGate(
          {
            utterance: text,
            context: s.messages.slice(-3).map((m) => m.content),
          },
          getConversationEnvironment().safety,
          {
            moderate: (r) => createOpenAIClient().moderations.create(r),
            classify: (r) => createOpenAIClient().responses.create(r),
          },
        ),
      ),
    // GENERATE covers Judge plus whichever of Reframe/Reflection follows it.
    // The Judge's own time is already in judge_logs.latency_ms, so the
    // remainder is the generation stage without threading a label through the
    // engine, which takes one transport for all of its calls.
    generate: (s) =>
      stage("GENERATE", getConversationEnvironment().judge.model, () =>
        planConversationTurn(s, getConversationEnvironment(), (r) =>
          createOpenAIClient().responses.create(r),
        ),
      ),
    openTurn: async (snapshot, token) =>
      stage("OPEN", null, async () => {
        const result = await ctx.admin.rpc("begin_conversation_opening", {
          p_user: ctx.userId,
          p_request: input.requestId,
          p_token: token,
          p_session: snapshot.session.id,
        });
        if (result.error) throw new Error("CONVERSATION_OPEN_BLOCKED");
      }),
    commit: async (phase, text, payload, version, token, fingerprint) => {
      if (!sessionId) throw new Error("CONVERSATION_NOT_FOUND");
      const result = await stage("COMMIT", null, async () =>
        ctx.admin.rpc("commit_conversation_step", {
          p_user: ctx.userId,
          p_request: input.requestId,
          p_token: token,
          p_fingerprint: fingerprint,
          p_session: sessionId,
          p_version: version,
          p_phase: phase,
          p_text: text,
          p_payload: payload,
        }),
      );
      // A visitor who reached the first question is told to connect an account
      // rather than shown a generic failure, so the reason is actionable.
      if (result.error)
        throw new Error(
          result.error.message === "IDENTITY_LINK_REQUIRED"
            ? "IDENTITY_LINK_REQUIRED"
            : "CONVERSATION_COMMIT_FAILED",
        );
      return result.data;
    },
  });
}
