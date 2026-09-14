import test from "node:test";
import assert from "node:assert/strict";
import {
  runStartRequest,
  proposalResponse,
  readFocusReceipt,
} from "../src/engine/start-request.ts";
import { readStartReceipt } from "../src/engine/start-approval.ts";
import { handleAIRequest } from "../src/lib/api/ai-http.ts";
import {
  startRequestSchema,
  approvalRequestSchema,
} from "../src/schemas/start-api.ts";
const userId = "10000000-0000-4000-8000-000000000001";
const sessionId = "20000000-0000-4000-8000-000000000001";
const messageId = "30000000-0000-4000-8000-000000000001";
const requestId = "40000000-0000-4000-8000-000000000001";
const secret = "test-secret-".repeat(4);
const owner = () => ({
  userId,
  sessionId,
  messageId,
  expiresAt: Date.now() + 60000,
});
const input = {
  userId,
  requestId,
  operation: "start" as const,
  body: "private thought",
};
test("start commits once before issuing an owner-bound approval receipt", async () => {
  const calls: string[] = [];
  const result = await runStartRequest(
    input,
    secret,
    {
      claim: async () => ({ status: "CLAIMED", token: requestId }),
      finish: async () => {
        throw Error("no second finish");
      },
    },
    async () => {
      calls.push("gate+model");
      return { kind: "CLEAR_AS_IS", question: "어떤 일을 할까?" };
    },
    async () => {
      calls.push("commit");
      return owner();
    },
  );
  assert.deepEqual(calls, ["gate+model", "commit"]);
  assert.ok("result" in result && "receipt" in result.result);
  if ("result" in result && "receipt" in result.result)
    assert.equal(
      readStartReceipt(result.result.receipt, userId, secret).sessionId,
      sessionId,
    );
});
test("duplicate requests never rerun models, writes or receipt issuance", async () => {
  for (const claim of [
    { status: "SUCCEEDED", result_id: sessionId },
    { status: "RUNNING", result_id: null },
    { status: "CONFLICT" },
    { status: "RATE_LIMITED", retry_after: 60 },
  ]) {
    const fail = async (): Promise<never> => {
      throw Error("must not execute");
    };
    assert.deepEqual(
      await runStartRequest(
        input,
        secret,
        { claim: async () => claim, finish: fail },
        fail,
        fail,
      ),
      claim,
    );
  }
});
test("uncertain commit is never retried and emits no private provider error", async () => {
  let commits = 0,
    finishes = 0;
  await assert.rejects(
    runStartRequest(
      input,
      secret,
      {
        claim: async () => ({ status: "CLAIMED", token: requestId }),
        finish: async () => {
          finishes++;
          return false;
        },
      },
      async () => ({ kind: "CLEAR_AS_IS", question: "어떤 일을 할까?" }),
      async () => {
        commits++;
        throw Error("private provider details");
      },
    ),
    /^Error: START_FAILED_OR_UNKNOWN$/,
  );
  assert.equal(commits, 1);
  assert.equal(finishes, 1);
});
test("focus receipt rejects changed candidates, owners and expiry", () => {
  const response = proposalResponse(
    owner(),
    {
      kind: "FOCUS_REQUIRED",
      question: "무엇부터 볼까요?",
      candidates: ["직장", "이사"],
    },
    secret,
  );
  assert.ok("receipt" in response);
  if (!("receipt" in response)) return;
  assert.deepEqual(
    readFocusReceipt(response.receipt, userId, secret).candidates,
    ["직장", "이사"],
  );
  assert.throws(() => readFocusReceipt(response.receipt, sessionId, secret));
  assert.throws(() =>
    readFocusReceipt(response.receipt, userId, secret, Date.now() + 61000),
  );
  const [payload, mac] = response.receipt.split(".");
  const value = JSON.parse(Buffer.from(payload, "base64url").toString());
  value.candidates = ["tampered", "value"];
  assert.throws(() =>
    readFocusReceipt(
      Buffer.from(JSON.stringify(value)).toString("base64url") + "." + mac,
      userId,
      secret,
    ),
  );
});
const env = {
  NOOK_SITE_URL: "https://nook.example",
  NOOK_START_API_ENABLED: "true",
};
function request(body: unknown, origin = "https://nook.example") {
  return new Request("https://nook.example/api/start", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
test("HTTP rejects cross-origin and supplied user IDs before executing", async () => {
  let calls = 0;
  const run = async () => {
    calls++;
    return { status: "SUCCEEDED" };
  };
  assert.equal(
    (
      await handleAIRequest(
        request({ requestId, thought: "생각" }, "https://evil.example"),
        startRequestSchema,
        run,
        env,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await handleAIRequest(
        request({ requestId, thought: "생각", userId }),
        startRequestSchema,
        run,
        env,
      )
    ).status,
    400,
  );
  assert.equal(calls, 0);
});
test("HTTP allows 5000 Korean characters and a signed approval, caps streamed bytes", async () => {
  const text = "가".repeat(5000);
  const receipt = proposalResponse(
    owner(),
    { kind: "CLEAR_AS_IS", question: text },
    secret,
  );
  assert.ok("receipt" in receipt);
  if (!("receipt" in receipt)) return;
  const run = async () => ({ status: "SUCCEEDED" });
  assert.equal(
    (
      await handleAIRequest(
        request({ requestId, receipt: receipt.receipt, finalText: text }),
        approvalRequestSchema,
        run,
        env,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await handleAIRequest(
        request({ requestId, thought: "가".repeat(30000) }),
        startRequestSchema,
        run,
        env,
      )
    ).status,
    400,
  );
});
test("HTTP preserves replay/rate semantics, no-store and disabled rollout", async () => {
  const body = { requestId, thought: "생각" };
  const limited = await handleAIRequest(
    request(body),
    startRequestSchema,
    async () => ({ status: "RATE_LIMITED", retry_after: 60 }),
    env,
  );
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("retry-after"), "60");
  assert.match(limited.headers.get("cache-control")!, /no-store/);
  assert.equal(
    (
      await handleAIRequest(
        request(body),
        startRequestSchema,
        async () => ({ status: "RUNNING" }),
        env,
      )
    ).status,
    202,
  );
  let called = false;
  assert.equal(
    (
      await handleAIRequest(
        request(body),
        startRequestSchema,
        async () => {
          called = true;
          return { status: "SUCCEEDED" };
        },
        { ...env, NOOK_START_API_ENABLED: "" },
      )
    ).status,
    503,
  );
  assert.equal(called, false);
});
