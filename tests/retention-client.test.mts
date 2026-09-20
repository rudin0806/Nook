import assert from "node:assert/strict";
import test from "node:test";
import {
  performRetentionAction,
  RetentionActionError,
} from "../src/lib/retention/client.ts";
const id = "11111111-1111-4111-8111-111111111111";
test("mutations use correct method, cookie credentials and verified acknowledgement", async () => {
  for (const action of ["trash", "restore", "delete-question"] as const) {
    const send: typeof fetch = async (url, options) => {
      assert.equal(
        url,
        action === "delete-question"
          ? `/api/branch-questions/${id}`
          : `/api/sessions/${id}/${action}`,
      );
      assert.equal(
        options?.method,
        action === "delete-question" ? "DELETE" : "POST",
      );
      assert.equal(options?.credentials, "same-origin");
      return Response.json({
        data:
          action === "delete-question"
            ? { branchQuestionId: id }
            : {
                sessionId: id,
                state: action === "trash" ? "trashed" : "saved",
              },
      });
    };
    await performRetentionAction(action, id, send);
  }
});
test("missing auth and expired restoration never report success or retry", async () => {
  for (const status of [401, 404, 409, 500]) {
    let calls = 0;
    await assert.rejects(
      performRetentionAction("restore", id, async () => {
        calls++;
        return new Response("private database error", { status });
      }),
      (e) =>
        e instanceof RetentionActionError &&
        e.needsLogin === (status === 401) &&
        !e.message.includes("private"),
    );
    assert.equal(calls, 1);
  }
});
test("wrong row acknowledgement and malformed identifiers are rejected", async () => {
  await assert.rejects(
    performRetentionAction("trash", id, async () =>
      Response.json({ data: { sessionId: "other", state: "trashed" } }),
    ),
  );
  let calls = 0;
  await assert.rejects(
    performRetentionAction("trash", "../other", async () => {
      calls++;
      return Response.json({});
    }),
  );
  assert.equal(calls, 0);
});

test("이어갈 대화를 치우는 요청은 휴지통과 삭제 둘 다 받아들인다", async () => {
  // 계정이 있으면 휴지통으로, 없으면 만료와 같게 지워진다. 어느 쪽이든 성공이다.
  for (const state of ["trashed", "deleted"] as const) {
    let called = 0;
    const send: typeof fetch = async (url, options) => {
      called += 1;
      assert.equal(url, `/api/sessions/${id}/discard`);
      assert.equal(options?.method, "POST");
      assert.equal(options?.credentials, "same-origin");
      assert.equal(options?.cache, "no-store");
      return Response.json({ data: { sessionId: id, state } });
    };
    await performRetentionAction("discard", id, send);
    assert.equal(called, 1);
  }
});

test("치우기 응답이 다른 상태를 말하면 성공으로 읽지 않는다", async () => {
  // `saved`는 이 경로가 만들 수 없는 상태다. 조용히 통과시키면 화면이 치운 척한다.
  await assert.rejects(
    performRetentionAction("discard", id, async () =>
      Response.json({ data: { sessionId: id, state: "saved" } }),
    ),
  );
});

test("치우기도 실패를 다시 시도하지 않는다", async () => {
  for (const status of [401, 404, 409, 500]) {
    let calls = 0;
    await assert.rejects(
      performRetentionAction("discard", id, async () => {
        calls++;
        return new Response(null, { status });
      }),
      (error: unknown) => {
        assert.ok(error instanceof RetentionActionError);
        assert.equal(error.needsLogin, status === 401);
        return true;
      },
    );
    assert.equal(calls, 1);
  }
});
