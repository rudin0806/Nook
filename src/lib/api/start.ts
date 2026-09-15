import "server-only";
import { restartSourceViewSchema } from "@/schemas/recovery";
import { randomUUID } from "node:crypto";
import type { z } from "zod";
import type {
  startRequestSchema,
  focusRequestSchema,
} from "@/schemas/start-api";
import type { StartFlowResult } from "@/engine/start-flow";
import { runStartRequest, readFocusReceipt } from "@/engine/start-request";
import { executeSafetyGate } from "@/engine/safety-gate";
import { createServerStartFlow, runNodeZero } from "@/lib/openai/start";
import { createOpenAIClient } from "@/lib/openai/server";
import { getStartEnvironment } from "@/lib/env/server";
import { ensureConversationActor } from "@/lib/supabase/anonymous";
import { createAdmissionContext } from "./ai-admission";

export async function startConversation(
  input: z.infer<typeof startRequestSchema>,
) {
  const options = getStartEnvironment();
  await ensureConversationActor(input.captchaToken);
  const context = await createAdmissionContext();
  const sessionId = randomUUID(),
    messageId = randomUUID();
  return runStartRequest(
    {
      userId: context.userId,
      requestId: input.requestId,
      operation: "start",
      body: JSON.stringify([input.thought, input.source ?? null]),
    },
    context.secret,
    context.store,
    async () => {
      if (input.source) {
        const source = await context.auth.rpc("read_restart_source", {
          p_kind: input.source.kind,
          p_id: input.source.id,
        });
        if (source.error) throw new Error("START_SOURCE_INVALID");
        restartSourceViewSchema.parse(source.data);
      }
      return createServerStartFlow(input.thought, options).start();
    },
    (result, token, fingerprint) =>
      commit(context, {
        requestId: input.requestId,
        sessionId,
        messageId,
        text: input.thought,
        origin: input.source,
        result,
        token,
        fingerprint,
      }),
  );
}

export async function selectStartFocus(
  input: z.infer<typeof focusRequestSchema>,
) {
  const options = getStartEnvironment();
  const context = await createAdmissionContext();
  const receipt = readFocusReceipt(
    input.receipt,
    context.userId,
    context.secret,
  );
  const focus = receipt.candidates[input.index];
  if (!focus) throw new Error("FOCUS_RECEIPT_INVALID");
  return runStartRequest(
    {
      userId: context.userId,
      requestId: input.requestId,
      operation: "focus",
      body: JSON.stringify([input.receipt, input.index]),
    },
    context.secret,
    context.store,
    async (): Promise<StartFlowResult> => {
      // RLS ownership/state check happens before any paid call. RPC repeats it under lock.
      const session = await context.auth
        .from("thought_sessions")
        .select("status,storage_state,temporary_expires_at")
        .eq("id", receipt.sessionId)
        .eq("user_id", context.userId)
        .single();
      if (
        session.error ||
        session.data.status !== "ACTIVE" ||
        session.data.storage_state !== "TEMPORARY" ||
        Date.parse(session.data.temporary_expires_at) <= Date.now()
      )
        throw new Error("START_SESSION_INVALID");
      const segment = await context.auth
        .from("segments")
        .select("node_count,turn_count")
        .eq("session_id", receipt.sessionId)
        .eq("ordinal", 1)
        .single();
      if (
        segment.error ||
        segment.data.node_count !== 0 ||
        segment.data.turn_count !== 1
      )
        throw new Error("START_FOCUS_ALREADY_SELECTED");
      const source = await context.auth
        .from("messages")
        .select("content")
        .eq("id", receipt.messageId)
        .eq("session_id", receipt.sessionId)
        .eq("kind", "RAW_THOUGHT")
        .eq("role", "USER")
        .single();
      if (source.error || !source.data.content.includes(focus))
        throw new Error("START_SOURCE_INVALID");
      const safety = await executeSafetyGate(
        { context: [source.data.content], utterance: focus },
        options.safety,
        {
          moderate: (request) =>
            createOpenAIClient().moderations.create(request),
          classify: (request) => createOpenAIClient().responses.create(request),
        },
      );
      if (safety.behavior === "STOP" || safety.behavior === "HANDOFF")
        return { kind: safety.behavior, safety };
      return {
        kind: "PROPOSAL",
        proposal: await runNodeZero(
          {
            raw_thought: source.data.content,
            selected_focus: focus,
            focus_reply: focus,
          },
          options.nodeZero,
        ),
      };
    },
    (result, token, fingerprint) =>
      commit(context, {
        requestId: input.requestId,
        sessionId: receipt.sessionId,
        messageId: randomUUID(),
        text: focus,
        result,
        token,
        fingerprint,
        sourceMessage: receipt.messageId,
        expiresAt: receipt.expiresAt,
      }),
  );
}

async function commit(
  context: Awaited<ReturnType<typeof createAdmissionContext>>,
  input: {
    requestId: string;
    sessionId: string;
    messageId: string;
    text: string;
    result: StartFlowResult;
    token: string;
    fingerprint: string;
    sourceMessage?: string;
    expiresAt?: number;
    origin?: { kind: "node" | "branch" | "session"; id: string };
  },
) {
  const safety =
    "safety" in input.result
      ? input.result.safety
      : { label: "NONE", category: "NONE", behavior: "CONTINUE" };
  const result = await context.admin.rpc("commit_start_with_recovery", {
    p_result: safety.behavior === "CONTINUE" ? input.result : null,
    p_origin_kind: input.origin?.kind ?? null,
    p_origin_id: input.origin?.id ?? null,
    p_user: context.userId,
    p_request: input.requestId,
    p_token: input.token,
    p_fingerprint: input.fingerprint,
    p_session: input.sessionId,
    p_message: input.messageId,
    p_text: safety.behavior === "STOP" ? null : input.text,
    p_behavior: safety.behavior,
    p_label: safety.label,
    p_category: safety.category,
    p_source_message: input.sourceMessage ?? null,
    p_expires_at: input.expiresAt
      ? new Date(input.expiresAt).toISOString()
      : null,
  });
  if (result.error) throw new Error("START_COMMIT_FAILED");
  return result.data;
}
