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
