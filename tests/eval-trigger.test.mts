import assert from "node:assert/strict";
import test from "node:test";
import { parseEvalTrigger } from "../scripts/eval-trigger.mts";
import {
  NOOK_MODEL_IDS,
  NOOK_REASONING_EFFORTS,
  requireNookModelId,
  requireNookReasoningEffort,
} from "../src/lib/openai/models.ts";

const valid = {
  requestedAt: "2026-09-13T12:35:00Z",
  model: "gpt-5.6-sol",
  reasoningEffort: "medium",
  ids: ["J-CLOSE-01", "J-HEDGE-01a"],
  maxCases: 2,
  maxOutputTokens: 1024,
};

test("accepts a bounded evaluation trigger", () => {
  assert.deepEqual(parseEvalTrigger(JSON.stringify(valid)), valid);
});

test("allows only the three approved Nook model tiers", () => {
  assert.deepEqual(NOOK_MODEL_IDS, [
    "gpt-5.6-luna",
    "gpt-5.6-terra",
    "gpt-5.6-sol",
  ]);
  for (const model of NOOK_MODEL_IDS)
    assert.equal(requireNookModelId(model), model);
  assert.throws(() => requireNookModelId("gpt-6-astra"), /MODEL_NOT_ALLOWED/);
  assert.throws(() => requireNookModelId("custom-model"), /MODEL_NOT_ALLOWED/);
});

test("allows only bounded evaluation reasoning levels", () => {
  assert.deepEqual(NOOK_REASONING_EFFORTS, ["low", "medium", "high"]);
  for (const effort of NOOK_REASONING_EFFORTS)
    assert.equal(requireNookReasoningEffort(effort), effort);
  assert.throws(
    () => requireNookReasoningEffort("xhigh"),
    /REASONING_EFFORT_NOT_ALLOWED/,
  );
});

test("rejects duplicate, excessive, malformed, and extended triggers", () => {
  const invalid = [
    { ...valid, ids: ["J-CLOSE-01", "J-CLOSE-01"] },
    { ...valid, maxCases: 1 },
    { ...valid, maxOutputTokens: 4097 },
    { ...valid, model: "bad model with spaces" },
    { ...valid, model: "gpt-6-astra" },
    { ...valid, reasoningEffort: "xhigh" },
    { ...valid, unexpected: true },
  ];
  for (const value of invalid)
    assert.throws(() => parseEvalTrigger(JSON.stringify(value)));
  assert.throws(() => parseEvalTrigger("not-json"));
});
