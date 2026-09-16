export type ApiProblem = {
  status: number;
  code: string;
  message: string;
};

const databaseProblems: Record<string, ApiProblem> = {
  AUTHENTICATION_REQUIRED: {
    status: 401,
    code: "AUTHENTICATION_REQUIRED",
    message: "로그인이 필요해요.",
  },
  IDENTITY_LINK_REQUIRED: {
    status: 409,
    code: "IDENTITY_LINK_REQUIRED",
    message: "보관하려면 소셜 계정을 연결해 주세요.",
  },
  KEEP_SESSION_DECISION_REQUIRED: {
    status: 400,
    code: "KEEP_SESSION_DECISION_REQUIRED",
    message: "기록 보관 여부를 선택해 주세요.",
  },
  SESSION_RETENTION_ALREADY_DECIDED: {
    status: 409,
    code: "SESSION_RETENTION_ALREADY_DECIDED",
    message: "이미 보관 여부를 선택한 기록이에요.",
  },
  DUPLICATE_BRANCH_SELECTION: {
    status: 422,
    code: "DUPLICATE_BRANCH_SELECTION",
    message: "같은 질문을 한 번만 선택해 주세요.",
  },
  INVALID_BRANCH_SELECTION: {
    status: 422,
    code: "INVALID_BRANCH_SELECTION",
    message: "이 기록에서 보관할 수 없는 질문이 포함되어 있어요.",
  },
  SESSION_NOT_FOUND: {
    status: 404,
    code: "SESSION_NOT_FOUND",
    message: "기록을 찾을 수 없어요.",
  },
  SAVED_SESSION_NOT_FOUND: {
    status: 404,
    code: "SAVED_SESSION_NOT_FOUND",
    message: "보관 중인 기록을 찾을 수 없어요.",
  },
  RESTORABLE_SESSION_NOT_FOUND: {
    status: 404,
    code: "RESTORABLE_SESSION_NOT_FOUND",
    message: "복원할 수 있는 기록을 찾을 수 없어요.",
  },
  KEPT_BRANCH_NOT_FOUND: {
    status: 404,
    code: "KEPT_BRANCH_NOT_FOUND",
    message: "남겨둔 질문을 찾을 수 없어요.",
  },
  SHELF_ORDER_STALE: {
    status: 409,
    code: "SHELF_ORDER_STALE",
    message: "책장 내용이 바뀌었어요. 목록을 새로고침해 주세요.",
  },
  INVALID_SHELF_POSITION: {
    status: 400,
    code: "INVALID_SHELF_POSITION",
    message: "옮길 자리를 다시 선택해 주세요.",
  },
};

export function mapDatabaseProblem(message: string): ApiProblem {
  const problemsBySpecificity = Object.entries(databaseProblems).sort(
    ([left], [right]) => right.length - left.length,
  );
  for (const [token, problem] of problemsBySpecificity) {
    if (message.includes(token)) return problem;
  }

  return {
    status: 500,
    code: "DATABASE_REQUEST_FAILED",
    message: "요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.",
  };
}

export function problemResponse(problem: ApiProblem): Response {
  return Response.json(
    { error: { code: problem.code, message: problem.message } },
    { status: problem.status, headers: { "Cache-Control": "no-store" } },
  );
}

export function dataResponse(data: unknown, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "private, no-store");
  return Response.json({ data }, { ...init, headers });
}
