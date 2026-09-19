import test from "node:test";
import assert from "node:assert/strict";
import {
  runAdmittedRequest,
  type AdmissionStore,
} from "../src/engine/admission.ts";
const userId = "10000000-0000-4000-8000-000000000001";
const requestId = "20000000-0000-4000-8000-000000000001";
const token = "30000000-0000-4000-8000-000000000001";
const input = { userId, requestId, operation: "start", body: "private text" };
const secret = "a".repeat(32);

test("all non-claimed states skip AI and completion", async () => {
  for (const reply of [
    { status: "RUNNING", result_id: null },
    { status: "SUCCEEDED", result_id: requestId },
    { status: "FAILED", result_id: null },
    { status: "CONFLICT" },
    { status: "BUSY", retry_after: 5 },
    { status: "RATE_LIMITED", retry_after: 30 },
  ]) {
    assert.deepEqual(
      await runAdmittedRequest(
        input,
        secret,
        {
          claim: async () => reply,
          finish: async () => assert.fail(),
        },
        async () => assert.fail(),
      ),
      reply,
    );
  }
});
test("successful request uses opaque fingerprint and finishes exactly once", async () => {
  let calls = 0,
    done = 0;
  const store: AdmissionStore = {
    claim: async (u, r, f) => {
      assert.equal(u, userId);
      assert.equal(r, requestId);
      assert.match(f, /^[a-f0-9]{64}$/);
      assert.ok(!f.includes("private"));
      return { status: "CLAIMED", token };
    },
    finish: async (u, r, t, s, id) => {
      done++;
      assert.deepEqual(
        [u, r, t, s, id],
        [userId, requestId, token, true, requestId],
      );
      return true;
    },
  };
  assert.deepEqual(
    await runAdmittedRequest(input, secret, store, async () => {
      calls++;
      return requestId;
    }),
    { status: "SUCCEEDED", result_id: requestId },
  );
  assert.equal(calls, 1);
  assert.equal(done, 1);
});
test("fingerprint binds operation, user and payload; repeats stay stable", async () => {
  const fingerprints: string[] = [];
  const store: AdmissionStore = {
    claim: async (_u, _r, f) => {
      fingerprints.push(f);
      return { status: "CONFLICT" };
    },
    finish: async () => assert.fail(),
  };
  for (const value of [
    input,
    input,
    { ...input, body: "other" },
    { ...input, operation: "turn" },
    { ...input, userId: requestId },
  ])
    await runAdmittedRequest(value, secret, store, async () => assert.fail());
  assert.equal(fingerprints[0], fingerprints[1]);
  assert.equal(new Set(fingerprints).size, 4);
});
test("malformed admission and database errors fail closed", async () => {
  for (const claim of [
    async () => ({ status: "CLAIMED", token: "bad" }),
    async () => {
      throw new Error("private");
    },
  ])
    await assert.rejects(
      runAdmittedRequest(
        input,
        secret,
        { claim, finish: async () => assert.fail() },
        async () => assert.fail(),
      ),
      /^Error: ADMISSION_UNAVAILABLE$/,
    );
});
test("failed AI is never retried even when completion fails", async () => {
  let calls = 0;
  await assert.rejects(
    runAdmittedRequest(
      input,
      secret,
      {
        claim: async () => ({ status: "CLAIMED", token }),
        finish: async () => {
          throw new Error("database details");
        },
      },
      async () => {
        calls++;
        throw new Error("private text");
      },
    ),
    /^Error: AI_OPERATION_FAILED$/,
  );
  assert.equal(calls, 1);
});
test("uncertain completion never reruns a successful operation", async () => {
  let calls = 0;
  await assert.rejects(
    runAdmittedRequest(
      input,
      secret,
      {
        claim: async () => ({ status: "CLAIMED", token }),
        finish: async () => false,
      },
      async () => {
        calls++;
        return null;
      },
    ),
    /^Error: ADMISSION_COMPLETION_UNKNOWN$/,
  );
  assert.equal(calls, 1);
});
test("invalid request identity and missing HMAC secret make no calls", async () => {
  const store: AdmissionStore = {
    claim: async () => assert.fail(),
    finish: async () => assert.fail(),
  };
  await assert.rejects(
    runAdmittedRequest(
      { ...input, requestId: "bad" },
      secret,
      store,
      async () => assert.fail(),
    ),
  );
  await assert.rejects(
    runAdmittedRequest(input, "", store, async () => assert.fail()),
    /ADMISSION_INPUT_INVALID/,
  );
});
