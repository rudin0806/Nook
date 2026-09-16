import { z } from "zod";

export type RetentionAction = "trash" | "restore" | "delete-question";
export class RetentionActionError extends Error {
  readonly needsLogin: boolean;
  constructor(needsLogin: boolean, message: string) {
    super(message);
    this.needsLogin = needsLogin;
  }
}

export async function saveSessionOrder(
  candidateIds: string[],
  send: typeof fetch = fetch,
) {
  const sessionIds = z.array(z.uuid()).min(1).max(50).parse(candidateIds);
  const response = await send("/api/sessions/order", {
    method: "PATCH",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionIds }),
  });
  if (!response.ok) {
    throw new RetentionActionError(
      response.status === 401,
      response.status === 401
        ? "로그인이 만료됐어요. 계정을 다시 연결해 주세요."
        : response.status === 409
          ? "책장 내용이 바뀌었어요. 목록을 새로고침한 뒤 다시 정리해 주세요."
          : "순서를 저장하지 못했어요. 목록을 확인한 뒤 다시 시도해 주세요.",
    );
  }
  z.object({
    data: z.object({ sessionIds: z.array(z.uuid()).length(sessionIds.length) }),
  }).parse(await response.json());
}

/** Moves one book, so a shelf larger than a page can still be ordered. */
export async function moveSessionToPosition(
  candidate: string,
  candidatePosition: number,
  send: typeof fetch = fetch,
) {
  const id = z.uuid().parse(candidate);
  const position = z.number().int().min(1).parse(candidatePosition);
  const response = await send(`/api/sessions/${id}/shelf-position`, {
    method: "PATCH",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ position }),
  });
  if (!response.ok) {
    throw new RetentionActionError(
      response.status === 401,
      response.status === 401
        ? "로그인이 만료됐어요. 계정을 다시 연결해 주세요."
        : response.status === 404
          ? "이 이야기가 책장에 없어요. 목록을 새로고침해 주세요."
          : "자리를 옮기지 못했어요. 목록을 확인한 뒤 다시 시도해 주세요.",
    );
  }
  const { data } = z
    .object({
      data: z.object({
        sessionId: z.literal(id),
        position: z.number().int().positive(),
      }),
    })
    .parse(await response.json());
  return data.position;
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
