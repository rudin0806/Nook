import { z } from "zod";

export type RetentionAction = "trash" | "restore" | "delete-question";
export class RetentionActionError extends Error {
  readonly needsLogin: boolean;
  constructor(needsLogin: boolean, message: string) {
    super(message);
    this.needsLogin = needsLogin;
  }
}

/** Cookie authentication only. Validate acknowledgement before showing success. */
export async function performRetentionAction(
  action: RetentionAction,
  candidate: string,
  send: typeof fetch = fetch,
) {
  const id = z.uuid().parse(candidate);
  const isQuestion = action === "delete-question";
  const response = await send(
    isQuestion
      ? `/api/branch-questions/${id}`
      : `/api/sessions/${id}/${action}`,
    {
      method: isQuestion ? "DELETE" : "POST",
      credentials: "same-origin",
      cache: "no-store",
    },
  );
  if (!response.ok) {
    const message =
      response.status === 401
        ? "로그인이 만료됐어요. 계정을 다시 연결해 주세요."
        : response.status === 404 || response.status === 409
          ? "기록의 상태가 바뀌었거나 복원 기한이 지났어요. 목록을 다시 확인해 주세요."
          : "요청을 완료하지 못했어요. 목록을 다시 확인한 뒤 시도해 주세요.";
    throw new RetentionActionError(response.status === 401, message);
  }
  const schema = isQuestion
    ? z.object({ data: z.object({ branchQuestionId: z.literal(id) }) })
    : z.object({
        data: z.object({
          sessionId: z.literal(id),
          state: z.literal(action === "trash" ? "trashed" : "saved"),
        }),
      });
  schema.parse(await response.json());
}
