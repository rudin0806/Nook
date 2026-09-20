import { z } from "zod";

export type RetentionAction =
  "trash" | "restore" | "discard" | "delete-question";
export class RetentionActionError extends Error {
  readonly needsLogin: boolean;
  constructor(needsLogin: boolean, message: string) {
    super(message);
    this.needsLogin = needsLogin;
  }
}

/** Moves one book, so a shelf larger than a page can still be ordered. */
export async function moveSessionToPosition(
  candidate: string,
  candidatePosition: number,
  expectedRevision: string,
  send: typeof fetch = fetch,
) {
  const id = z.uuid().parse(candidate);
  const position = z.number().int().min(1).parse(candidatePosition);
  const response = await send(`/api/sessions/${id}/shelf-position`, {
    method: "PATCH",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ position, expectedRevision }),
  });
  if (!response.ok) {
    throw new RetentionActionError(
      response.status === 401,
      response.status === 401
        ? "로그인이 만료됐어요. 계정을 다시 연결해 주세요."
        : response.status === 409
          ? "책장 순서가 다른 곳에서 바뀌었어요. 새로고침한 뒤 다시 정리해 주세요."
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
        revision: z.string().regex(/^[a-f0-9]{32}$/),
      }),
    })
    .parse(await response.json());
  return data;
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
  // `discard`는 계정이 있으면 휴지통으로, 없으면 만료와 같게 지워진다.
  const expectedState =
    action === "trash"
      ? z.literal("trashed")
      : action === "discard"
        ? z.enum(["trashed", "deleted"])
        : z.literal("saved");
  const schema = isQuestion
    ? z.object({ data: z.object({ branchQuestionId: z.literal(id) }) })
    : z.object({
        data: z.object({ sessionId: z.literal(id), state: expectedState }),
      });
  schema.parse(await response.json());
}
