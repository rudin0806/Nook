import { z } from "zod";
import { parseJson, RequestInputError } from "./request.ts";
import { dataResponse, problemResponse } from "./problem.ts";
import { isSameOriginPost, siteOrigin } from "../auth/policy.ts";

/** Same-origin cookie API. Errors and request bodies must never be logged. */
export async function handleAIRequest<T>(
  request: Request,
  schema: z.ZodType<T>,
  run: (input: T) => Promise<{ status: string; retry_after?: number }>,
  environment: {
    NOOK_SITE_URL?: string;
    NOOK_START_API_ENABLED?: string;
  } = {
    NOOK_SITE_URL: process.env.NOOK_SITE_URL,
    NOOK_START_API_ENABLED: process.env.NOOK_START_API_ENABLED,
  },
) {
  try {
    if (!isSameOriginPost(request, siteOrigin(environment.NOOK_SITE_URL)))
      return problemResponse({
        status: 403,
        code: "ORIGIN_REJECTED",
        message: "현재 페이지에서 다시 요청해 주세요.",
      });
    const input = await parseJson(request, schema, 64 * 1024);
    if (environment.NOOK_START_API_ENABLED !== "true")
      return problemResponse({
        status: 503,
        code: "START_NOT_ENABLED",
        message: "대화 연결을 준비하고 있어요.",
      });
    const result = await run(input);
    const status =
      result.status === "RATE_LIMITED" || result.status === "BUSY"
        ? 429
        : result.status === "RUNNING"
          ? 202
          : result.status === "CONFLICT" || result.status === "FAILED"
            ? 409
            : 200;
    return dataResponse(result, {
      status,
      headers: result.retry_after
        ? { "Retry-After": String(result.retry_after) }
        : undefined,
    });
  } catch (error) {
    if (error instanceof RequestInputError)
      return problemResponse({
        status: 400,
        code: error.code,
        message: error.publicMessage,
      });
    const code = error instanceof Error ? error.message : "";
    if (
      [
        "AUTHENTICATION_REQUIRED",
        "ANONYMOUS_CREATION_DISABLED",
        "CAPTCHA_REQUIRED",
      ].includes(code)
    )
      return problemResponse({
        status: 401,
        code,
        message: "로그인하거나 사용자 확인을 완료해 주세요.",
      });
    if (["APPROVAL_RECEIPT_INVALID", "FOCUS_RECEIPT_INVALID"].includes(code))
      return problemResponse({
        status: 409,
        code,
        message: "질문 제안이 만료되었거나 유효하지 않아요.",
      });
    return problemResponse({
      status: 503,
      code: "AI_REQUEST_FAILED_OR_UNKNOWN",
      message:
        "처리 결과를 확인하지 못했어요. 같은 요청으로 다시 확인해 주세요.",
    });
  }
}
