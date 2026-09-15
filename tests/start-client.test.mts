import test from "node:test";
import assert from "node:assert/strict";
import { makeStartRequest, sendStartRequest } from "../src/lib/start/client.ts";
const id = "10000000-0000-4000-8000-000000000001";
const request = makeStartRequest("start", { thought: "이직할까?" }, id);
const reply = (data: unknown, status = 200) =>
  (async () => Response.json({ data }, { status })) as typeof fetch;
test("manual retry sends identical ID/body, never auto-retries network errors", async () => {
  const bodies: unknown[] = [];
  const send = (async (_url, init) => {
    bodies.push(init?.body);
    throw Error("private network failure");
  }) as typeof fetch;
  const result = await sendStartRequest(request, send);
  assert.equal(bodies.length, 1);
  assert.ok(result.kind === "notice" && result.retryable);
  await sendStartRequest(request, send);
  assert.equal(bodies[0], bodies[1]);
});
test("proposal is not approved and replay without proposal is not a saved Node", async () => {
  assert.deepEqual(
    await sendStartRequest(
      request,
      reply({ status: "SUCCEEDED", result_id: id }),
    ),
    { kind: "view", view: { kind: "replay" }, sessionId: id },
  );
  const result = await sendStartRequest(
    request,
    reply({
      status: "SUCCEEDED",
      result_id: id,
      result: { kind: "CLEAR_AS_IS", question: "이직할까?", receipt: "signed" },
    }),
  );
  assert.ok(result.kind === "view" && result.view.kind === "proposal");
});
test("approval needs valid acknowledgement; malformed or wrong-status success stays uncertain", async () => {
  const approved = makeStartRequest(
    "approve",
    { receipt: "signed", finalText: "이직할까?" },
    id,
  );
  assert.deepEqual(
    await sendStartRequest(
      approved,
      reply({ status: "SUCCEEDED", result_id: id }),
    ),
    { kind: "view", view: { kind: "approved", nodeId: id } },
  );
  for (const send of [
    reply({ status: "SUCCEEDED", result_id: "invalid" }),
    reply({ status: "SUCCEEDED", result_id: id }, 500),
  ]) {
    const result = await sendStartRequest(approved, send);
    assert.ok(result.kind === "notice" && result.retryable);
  }
});
test("Safety approval replay never displays confirmation or invents contacts", async () => {
  const result = await sendStartRequest(
    makeStartRequest("approve", {}, id),
    reply({ status: "SAFETY_BLOCKED", result_id: id, replayed: true }),
  );
  assert.ok(
    result.kind === "view" &&
      result.view.kind === "stopped" &&
      result.view.contact === undefined,
  );
});
test("running and limits retain pending request and server delay", async () => {
  for (const [data, status] of [
    [{ status: "RUNNING", result_id: null }, 202],
    [{ status: "RATE_LIMITED", retry_after: 60 }, 429],
    [{ status: "BUSY", retry_after: 5 }, 429],
  ] as const) {
    const result = await sendStartRequest(request, reply(data, status));
    assert.ok(
      result.kind === "notice" && result.retryable && result.retryAfter! > 0,
    );
  }
});
test("login, disabled and expired proposal have distinct recovery", async () => {
  const send = (code: string, status: number) =>
    (async () =>
      Response.json({ error: { code } }, { status })) as typeof fetch;
  const login = await sendStartRequest(
    request,
    send("AUTHENTICATION_REQUIRED", 401),
  );
  assert.ok(login.kind === "notice" && login.login && !login.retryable);
  const disabled = await sendStartRequest(
    request,
    send("START_NOT_ENABLED", 503),
  );
  assert.ok(disabled.kind === "notice" && !disabled.retryable);
  const expired = await sendStartRequest(
    request,
    send("APPROVAL_RECEIPT_INVALID", 409),
  );
  assert.ok(expired.kind === "view" && expired.view.kind === "info");
});
test("focus selection and STOP response are parsed without rendering arbitrary markup", async () => {
  const result = await sendStartRequest(
    request,
    reply({
      status: "SUCCEEDED",
      result_id: id,
      result: {
        kind: "FOCUS_REQUIRED",
        question: "무엇부터 볼까요?",
        candidates: ["직장", "이사"],
        receipt: "signed",
      },
    }),
  );
  assert.ok(result.kind === "view" && result.view.kind === "focus");
  const stopped = await sendStartRequest(
    request,
    reply({
      status: "SUCCEEDED",
      result_id: id,
      result: {
        kind: "STOP",
        safety: {
          behavior: "STOP",
          contact: { primary: "109", urgent: "119" },
        },
      },
    }),
  );
  assert.ok(stopped.kind === "view" && stopped.view.kind === "stopped");
  const bad = await sendStartRequest(
    request,
    reply({
      status: "SUCCEEDED",
      result_id: id,
      result: {
        kind: "STOP",
        safety: {
          behavior: "STOP",
          contact: { primary: "javascript:alert(1)" },
        },
      },
    }),
  );
  assert.ok(bad.kind === "notice" && bad.retryable);
});
