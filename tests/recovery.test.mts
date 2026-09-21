import assert from "node:assert/strict";
import test from "node:test";
import {
  proposalResponse,
  readFocusReceipt,
} from "../src/engine/start-request.ts";
import { readStartReceipt } from "../src/engine/start-approval.ts";
import { startResultView } from "../src/lib/start/client.ts";
import {
  recoveryPageSchema,
  storedStartResultSchema,
  restartSourceSchema,
} from "../src/schemas/recovery.ts";
import { startRequestSchema } from "../src/schemas/start-api.ts";
const userId = "10000000-0000-4000-8000-000000000001";
const sessionId = "20000000-0000-4000-8000-000000000001";
const messageId = "30000000-0000-4000-8000-000000000001";
const secret = "test-only-recovery-key-".repeat(3);
test("recovery signs existing approved-gate draft without resetting its original expiry", () => {
  const owner = {
    userId,
    sessionId,
    messageId,
    expiresAt: Date.now() + 120000,
  };
  const result = proposalResponse(
    owner,
    storedStartResultSchema.parse({
      kind: "CLEAR_AS_IS",
      question: "어떤 일을 하고 싶을까?",
    }),
    secret,
  );
  const client = startResultView(result);
  assert.equal(client.view.kind, "proposal");
  if (client.view.kind !== "proposal") throw new Error("not proposal");
  const token = client.view.receipt;
  const receipt = readStartReceipt(token, userId, secret);
  assert.equal(receipt.expiresAt, owner.expiresAt);
  assert.equal(receipt.sessionId, sessionId);
  assert.throws(() => readStartReceipt(token, messageId, secret));
});
test("focus recovery preserves choices and cannot extend an expired conversation", () => {
  const owner = {
    userId,
    sessionId,
    messageId,
    expiresAt: Date.now() + 120000,
  };
  const result = proposalResponse(
    owner,
    {
      kind: "FOCUS_REQUIRED",
      question: "어느 질문부터 볼까요?",
      candidates: ["직장", "이사"],
    },
    secret,
  );
  assert.ok("receipt" in result);
  const focus = readFocusReceipt(result.receipt, userId, secret);
  assert.deepEqual(focus.candidates, ["직장", "이사"]);
  assert.equal(focus.expiresAt, owner.expiresAt);
  assert.throws(() =>
    proposalResponse(
      { ...owner, expiresAt: Date.now() - 1 },
      { kind: "CLEAR_AS_IS", question: "이직할까?" },
      secret,
    ),
  );
});
test("Safety and malformed provider output cannot become recoverable normal drafts", () => {
  for (const kind of ["STOP", "HANDOFF", "UNKNOWN"])
    assert.equal(storedStartResultSchema.safeParse({ kind }).success, false);
  assert.equal(
    storedStartResultSchema.safeParse({
      kind: "PROPOSAL",
      proposal: { question: "invented" },
    }).success,
    false,
  );
});
test("restart request binds a typed source identifier and rejects URL or ownership overrides", () => {
  for (const kind of ["node", "branch", "session"])
    assert.ok(
      startRequestSchema.safeParse({
        requestId: messageId,
        thought: "이직할까?",
        source: { kind, id: sessionId },
      }).success,
    );
  assert.equal(
    restartSourceSchema.safeParse({ kind: "node", id: "../../other" }).success,
    false,
  );
  assert.equal(
    startRequestSchema.safeParse({
      requestId: messageId,
      thought: "이직할까?",
      source: { kind: "node", id: sessionId, userId },
    }).success,
    false,
  );
});
test("recovery pages carry an exact non-negative total independent of the visible page", () => {
  const page = recoveryPageSchema.parse({
    items: [],
    hasMore: true,
    total: 7,
  });
  assert.equal(page.total, 7);
  assert.equal(
    recoveryPageSchema.safeParse({ items: [], hasMore: false, total: -1 })
      .success,
    false,
  );
  assert.equal(
    recoveryPageSchema.safeParse({ items: [], hasMore: false }).success,
    false,
  );
});
