import test from "node:test";
import assert from "node:assert/strict";
import {
  issueStartReceipt,
  readStartReceipt,
  approveStartQuestion,
  type StartApprovalStore,
} from "../src/engine/start-approval.ts";

const userId = "10000000-0000-4000-8000-000000000001";
const sessionId = "20000000-0000-4000-8000-000000000001";
const messageId = "30000000-0000-4000-8000-000000000001";
const requestId = "40000000-0000-4000-8000-000000000001";
const nodeId = "50000000-0000-4000-8000-000000000001";
const secret = "test-only-".repeat(5);
const question = "회사를 옮길까?";
function receipt() {
  return issueStartReceipt(
    { userId, sessionId, messageId, expiresAt: Date.now() + 60_000 },
    { kind: "CLEAR_AS_IS", question },
    secret,
  );
}
function fixture(claim: unknown = { status: "CLAIMED", token: requestId }) {
  const calls: string[] = [];
  const store: StartApprovalStore = {
    async claim() {
      calls.push("claim");
      return claim;
    },
    async readSource() {
      calls.push("source");
      return "회사를 옮길까?";
    },
    async finish() {
      calls.push("finish");
      return true;
    },
    async commit(input) {
      calls.push("commit");
      assert.equal(input.receipt.question, question);
      return nodeId;
    },
  };
  return { calls, store };
}
test("signed proposal binds user/session/source and rejects tampering, expiry and key rotation", () => {
  const token = receipt();
  assert.equal(readStartReceipt(token, userId, secret).sessionId, sessionId);
  assert.throws(
    () => readStartReceipt(token, sessionId, secret),
    /RECEIPT_INVALID/,
  );
  assert.throws(
    () => readStartReceipt(token, userId, secret + "changed"),
    /RECEIPT_INVALID/,
  );
  assert.throws(
    () => readStartReceipt(token, userId, secret, Date.now() + 61_000),
    /RECEIPT_INVALID/,
  );
  const [payload, mac] = token.split(".");
  const changed = JSON.parse(Buffer.from(payload, "base64url").toString());
  changed.sessionId = messageId;
  assert.throws(() =>
    readStartReceipt(
      `${Buffer.from(JSON.stringify(changed)).toString("base64url")}.${mac}`,
      userId,
      secret,
    ),
  );
  assert.throws(
    () =>
      issueStartReceipt(
        { userId, sessionId, messageId, expiresAt: Date.now() + 1_000 },
        { kind: "NEEDS_INFO", guidance: "안내" },
        secret,
      ),
    /NO_PROPOSAL/,
  );
});
test("unchanged approval uses one atomic commit, never a second finish or model call", async () => {
  const { calls, store } = fixture();
  const result = await approveStartQuestion(
    { userId, requestId, receipt: receipt(), finalText: question },
    secret,
    store,
    async () => {
      throw new Error("must not call");
    },
  );
  assert.deepEqual(result, { status: "SUCCEEDED", result_id: nodeId });
  assert.deepEqual(calls, ["claim", "source", "commit"]);
});
test("all duplicate, conflict and quota results bypass source, Safety and commit", async () => {
  for (const claim of [
    { status: "RUNNING", result_id: null },
    { status: "SUCCEEDED", result_id: nodeId },
    { status: "FAILED", result_id: null },
    { status: "CONFLICT" },
    { status: "BUSY", retry_after: 5 },
    { status: "RATE_LIMITED", retry_after: 60 },
  ]) {
    const { calls, store } = fixture(claim);
    assert.deepEqual(
      await approveStartQuestion(
        { userId, requestId, receipt: receipt(), finalText: question },
        secret,
        store,
        async () => {
          throw new Error();
        },
      ),
      claim,
    );
    assert.deepEqual(calls, ["claim"]);
  }
});
test("edited question passes contextual Safety before persistence; STOP/HANDOFF never create a Node", async () => {
  for (const output of [
    { label: "NONE", category: "NONE" },
    { label: "HIGH_RISK", category: "SUICIDE_SELF_HARM" },
    { label: "NONE", category: "GENERAL_MENTAL_HEALTH" },
  ]) {
    const { calls, store } = fixture();
    const result = await approveStartQuestion(
      { userId, requestId, receipt: receipt(), finalText: "다른 일을 해볼까?" },
      secret,
      store,
      async (input) => {
        calls.push("safety");
        assert.deepEqual(input.context, [question]);
        return output;
      },
    );
    const allowed = output.category === "NONE";
    assert.equal(result.status, allowed ? "SUCCEEDED" : "SAFETY_BLOCKED");
    assert.deepEqual(calls, [
      "claim",
      "source",
      "safety",
      allowed ? "commit" : "finish",
    ]);
  }
});
test("ownership, malformed Safety and unknown commit failures are scrubbed and never retried", async () => {
  for (const stage of ["source", "safety", "commit"]) {
    const { calls, store } = fixture();
    if (stage === "source")
      store.readSource = async () => {
        calls.push("source");
        throw new Error("private details");
      };
    if (stage === "commit")
      store.commit = async () => {
        calls.push("commit");
        throw new Error("lost response");
      };
    await assert.rejects(
      approveStartQuestion(
        {
          userId,
          requestId,
          receipt: receipt(),
          finalText: "다른 일을 해볼까?",
        },
        secret,
        store,
        async () => {
          calls.push("safety");
          return stage === "safety"
            ? { label: "unknown" }
            : { label: "NONE", category: "NONE" };
        },
      ),
      /^Error: APPROVAL_FAILED_OR_UNKNOWN$/,
    );
    assert.equal(
      calls.filter((x) => x === "commit").length,
      stage === "commit" ? 1 : 0,
    );
    assert.equal(calls.at(-1), "finish");
  }
});
test("invalid receipt and input never consume a quota", async () => {
  const { calls, store } = fixture();
  await assert.rejects(
    approveStartQuestion(
      { userId, requestId, receipt: "invalid", finalText: question },
      secret,
      store,
      async () => null,
    ),
  );
  await assert.rejects(
    approveStartQuestion(
      { userId, requestId, receipt: receipt(), finalText: " " },
      secret,
      store,
      async () => null,
    ),
  );
  assert.deepEqual(calls, []);
});

test("public adapter termination is atomic and never followed by separate finish", async () => {
  const { calls, store } = fixture();
  store.terminate = async (input) => {
    calls.push("terminate");
    assert.equal(input.safety.behavior, "HANDOFF");
    assert.equal(input.receipt.sessionId, sessionId);
    return sessionId;
  };
  const result = await approveStartQuestion(
    {
      userId,
      requestId,
      receipt: receipt(),
      finalText: "전문 도움을 찾고 싶어요",
    },
    secret,
    store,
    async () => ({ label: "NONE", category: "GENERAL_MENTAL_HEALTH" }),
  );
  assert.equal(result.status, "SAFETY_BLOCKED");
  assert.deepEqual(calls, ["claim", "source", "terminate"]);
});
