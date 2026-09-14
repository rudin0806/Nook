import { z } from "zod";
import { nodeZeroOutputSchema, rawThoughtSchema } from "../../schemas/start.ts";

const receipt = z.string().min(1).max(32000);
const safetySchema = z.object({
  behavior: z.enum(["STOP", "HANDOFF"]),
  contact: z
    .object({
      primary: z.string().regex(/^[0-9-]+$/),
      urgent: z
        .string()
        .regex(/^[0-9-]+$/)
        .optional(),
    })
    .nullable(),
});
const resultSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("PROPOSAL"),
    proposal: nodeZeroOutputSchema,
    receipt,
  }),
  z.object({
    kind: z.literal("CLEAR_AS_IS"),
    question: rawThoughtSchema,
    receipt,
  }),
  z.object({
    kind: z.literal("FOCUS_REQUIRED"),
    question: z.string().min(1).max(1000),
    candidates: z.array(z.string().min(1).max(500)).min(2).max(10),
    receipt,
  }),
  z.object({
    kind: z.literal("NEEDS_INFO"),
    guidance: z.string().min(1).max(1000),
  }),
  z.object({ kind: z.enum(["STOP", "HANDOFF"]), safety: safetySchema }),
]);
const responseSchema = z.object({
  data: z.discriminatedUnion("status", [
    z.object({
      status: z.literal("SUCCEEDED"),
      result_id: z.uuid(),
      result: resultSchema.optional(),
    }),
    z.object({
      status: z.literal("SAFETY_BLOCKED"),
      result_id: z.uuid(),
      safety: safetySchema.optional(),
      replayed: z.boolean().optional(),
    }),
    z.object({ status: z.literal("RUNNING"), result_id: z.uuid().nullable() }),
    z.object({
      status: z.enum(["BUSY", "RATE_LIMITED"]),
      retry_after: z.number().int().positive().max(86400),
    }),
    z.object({ status: z.literal("CONFLICT") }),
    z.object({ status: z.literal("FAILED"), result_id: z.null() }),
  ]),
});
export type StartView =
  | { kind: "input" }
  | { kind: "proposal"; question: string; evidence?: string; receipt: string }
  | { kind: "focus"; question: string; candidates: string[]; receipt: string }
  | { kind: "info"; message: string }
  | {
      kind: "stopped";
      behavior?: "STOP" | "HANDOFF";
      contact?: z.infer<typeof safetySchema>["contact"];
    }
  | { kind: "approved"; nodeId: string }
  | { kind: "replay" };
export type StartClientResult =
  | { kind: "view"; view: StartView }
  | {
      kind: "notice";
      message: string;
      retryable: boolean;
      retryAfter?: number;
      login?: boolean;
    };
export type StartOperation = "start" | "focus" | "approve";
export type PendingStartRequest = Readonly<{
  operation: StartOperation;
  body: string;
}>;

/** Keep only in component memory; exact request bytes and ID survive manual retry. */
export function makeStartRequest(
  operation: StartOperation,
  input: Record<string, unknown>,
  requestId = crypto.randomUUID(),
): PendingStartRequest {
  z.uuid().parse(requestId);
  return Object.freeze({
    operation,
    body: JSON.stringify({ ...input, requestId }),
  });
}
export async function sendStartRequest(
  pending: PendingStartRequest,
  send: typeof fetch = fetch,
): Promise<StartClientResult> {
  const unknownResult: StartClientResult = {
    kind: "notice",
    message:
      "처리 결과를 확인하지 못했어요. 아래 버튼으로 같은 요청의 결과를 다시 확인해 주세요.",
    retryable: true,
  };
  let response: Response;
  try {
    response = await send(
      pending.operation === "start"
        ? "/api/start"
        : `/api/start/${pending.operation}`,
      {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: pending.body,
        signal: AbortSignal.timeout(125000),
      },
    );
  } catch {
    return unknownResult;
  }
  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    return unknownResult;
  }
  const error = z
    .object({ error: z.object({ code: z.string() }) })
    .safeParse(raw);
  if (error.success) {
    const code = error.data.error.code;
    if (response.status === 401)
      return {
        kind: "notice",
        message:
          "로그인 후 다시 시작해 주세요. 로그인 화면으로 이동하면 작성 중인 입력은 유지되지 않아요.",
        retryable: false,
        login: true,
      };
    if (code === "START_NOT_ENABLED")
      return {
        kind: "notice",
        message: "대화 연결을 준비하고 있어요. 입력은 저장되지 않았어요.",
        retryable: false,
      };
    if (["APPROVAL_RECEIPT_INVALID", "FOCUS_RECEIPT_INVALID"].includes(code))
      return {
        kind: "view",
        view: {
          kind: "info",
          message:
            "질문 제안이 만료되었거나 계정이 바뀌었어요. 다시 시작해 주세요.",
        },
      };
    if (response.status === 400 || response.status === 403)
      return {
        kind: "notice",
        message: "요청을 보낼 수 없어요. 입력과 현재 페이지를 확인해 주세요.",
        retryable: false,
      };
    return unknownResult;
  }
  const parsed = responseSchema.safeParse(raw);
  if (!parsed.success) return unknownResult;
  const data = parsed.data.data;
  const expectedStatus =
    data.status === "RUNNING"
      ? 202
      : ["BUSY", "RATE_LIMITED"].includes(data.status)
        ? 429
        : ["CONFLICT", "FAILED"].includes(data.status)
          ? 409
          : 200;
  if (response.status !== expectedStatus) return unknownResult;
  if (data.status === "RUNNING")
    return {
      kind: "notice",
      message: "아직 처리 중이에요. 잠시 뒤 결과를 확인해 주세요.",
      retryable: true,
      retryAfter: 3,
    };
  if (data.status === "BUSY" || data.status === "RATE_LIMITED")
    return {
      kind: "notice",
      message:
        data.status === "BUSY"
          ? "다른 요청을 처리 중이에요. 잠시 뒤 다시 확인해 주세요."
          : "요청 가능 횟수를 모두 사용했어요. 잠시 뒤 다시 시도해 주세요.",
      retryable: true,
      retryAfter: data.retry_after,
    };
  if (data.status === "FAILED" || data.status === "CONFLICT")
    return {
      kind: "view",
      view: {
        kind: "info",
        message: "이 요청을 완료하지 못했어요. 다시 시작해 주세요.",
      },
    };
  if (data.status === "SAFETY_BLOCKED")
    return {
      kind: "view",
      view: {
        kind: "stopped",
        behavior: data.safety?.behavior,
        contact: data.safety?.contact,
      },
    };
  if (data.status !== "SUCCEEDED") return unknownResult;
  if (pending.operation === "approve") {
    if (data.result) return unknownResult;
    return { kind: "view", view: { kind: "approved", nodeId: data.result_id } };
  }
  const result = data.result;
  if (!result) return { kind: "view", view: { kind: "replay" } };
  if (result.kind === "PROPOSAL")
    return {
      kind: "view",
      view: {
        kind: "proposal",
        question: result.proposal.question,
        evidence: result.proposal.evidence_sentence,
        receipt: result.receipt,
      },
    };
  if (result.kind === "CLEAR_AS_IS")
    return {
      kind: "view",
      view: {
        kind: "proposal",
        question: result.question,
        receipt: result.receipt,
      },
    };
  if (result.kind === "FOCUS_REQUIRED")
    return {
      kind: "view",
      view: {
        kind: "focus",
        question: result.question,
        candidates: result.candidates,
        receipt: result.receipt,
      },
    };
  if (result.kind === "NEEDS_INFO")
    return { kind: "view", view: { kind: "info", message: result.guidance } };
  return {
    kind: "view",
    view: {
      kind: "stopped",
      behavior: result.safety.behavior,
      contact: result.safety.contact,
    },
  };
}
