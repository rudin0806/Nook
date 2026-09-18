import "server-only";
import { createAdmissionContext } from "./ai-admission";
import { loadConversation } from "./conversation-context";
import { runConversationRequest } from "@/engine/conversation-request";
import { planConversationTurn } from "@/engine/conversation";
import { executeSafetyGate } from "@/engine/safety-gate";
import { createOpenAIClient } from "@/lib/openai/server";
import { getConversationEnvironment } from "@/lib/env/server";
import type { ConversationRequest } from "@/schemas/conversation";

/** How long each stage of a turn takes, and nothing else.
 *
 * A measured turn averages 15.3s end to end while `judge_logs` accounts for
 * 6.4s of it, so two thirds of the wait had no record anywhere. This adds no
 * model call: it times the calls that already happen. Only a stage name, a
 * duration and the configured model are written — no utterance, no identifier,
 * no request body — which keeps the operational log separate from the user's
 * record. Read it in the Vercel runtime log, filtered on `nook_stage`.
 */
function stage<T>(name: string, model: string | null, run: () => Promise<T>) {
  const started = Date.now();
  const done = (outcome: "ok" | "failed") =>
    console.log(
      JSON.stringify({
        evt: "nook_stage",
        stage: name,
        ms: Date.now() - started,
        ...(model ? { model } : {}),
        outcome,
      }),
    );
  return run().then(
    (value) => {
      done("ok");
      return value;
    },
    (error) => {
      done("failed");
      throw error;
    },
  );
}

export async function converse(input: ConversationRequest) {
  const ctx = await createAdmissionContext();
  let sessionId: string | undefined;
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
