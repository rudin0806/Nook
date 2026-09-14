import { z } from "zod";
import {
  conversationRequestSchema,
  conversationViewSchema,
  type ConversationRequest,
} from "../../schemas/conversation.ts";
import { mapSafety } from "../../engine/safety.ts";
export function makeConversationRequest(
  input: Omit<ConversationRequest, "requestId">,
  id = crypto.randomUUID(),
) {
  return JSON.stringify(
    conversationRequestSchema.parse({ ...input, requestId: id }),
  );
}
export async function readConversation(
  nodeId: string,
  signal?: AbortSignal,
  send: typeof fetch = fetch,
) {
  z.uuid().parse(nodeId);
  const response = await send(`/api/conversation?nodeId=${nodeId}`, {
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  if (!response.ok)
    throw new Error(
      response.status === 401
        ? "LOGIN_REQUIRED"
        : response.status === 503
          ? "NOT_ENABLED"
          : "READ_FAILED",
    );
  const raw = z
    .object({ data: conversationViewSchema })
    .parse(await response.json());
  return raw.data;
}
export async function sendConversation(
  body: string,
  send: typeof fetch = fetch,
) {
  const response = await send("/api/conversation", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body,
  });
  if (response.status === 401) return { kind: "login" as const };
  if (response.status >= 500) throw new Error("OUTCOME_UNKNOWN");
  if (response.status === 400 || response.status === 403)
    return { kind: "failed" as const };
  const envelope = z
    .object({
      data: z.discriminatedUnion("status", [
        z.object({
          status: z.literal("SUCCEEDED"),
          result: z.object({
            version: z.number().int().nonnegative(),
            mode: z.enum([
              "READY",
              "SHIFT",
              "CLOSE",
              "STRUCTURAL",
              "FINISHED",
              "STOP",
              "HANDOFF",
            ]),
            label: z.string().optional(),
            category: z.string().optional(),
          }),
        }),
        z.object({
          status: z.enum(["BUSY", "RATE_LIMITED"]),
          retry_after: z.number().int().positive().max(86400),
        }),
        z.object({ status: z.enum(["RUNNING", "CONFLICT", "FAILED"]) }),
      ]),
    })
    .parse(await response.json());
  const data = envelope.data;
  if (data.status === "SUCCEEDED")
    return {
      kind: "done" as const,
      result: data.result,
      safety: ["STOP", "HANDOFF"].includes(data.result.mode)
        ? mapSafety({
            label: data.result.label,
            category: data.result.category,
          })
        : null,
    };
  if (data.status === "BUSY" || data.status === "RATE_LIMITED")
    return { kind: "wait" as const, seconds: data.retry_after };
  if (data.status === "RUNNING") return { kind: "wait" as const, seconds: 3 };
  return { kind: "failed" as const };
}
