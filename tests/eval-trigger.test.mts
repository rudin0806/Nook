import assert from "node:assert/strict";
import test from "node:test";
import { parseEvalTrigger } from "../scripts/eval-trigger.mts";

const valid = {
  requestedAt: "2026-09-13T12:35:00Z",
  model: "gpt-5.6-sol",
  ids: ["J-CLOSE-01", "J-HEDGE-01a"],
  maxCases: 2,
  maxOutputTokens: 1024,
};

test("accepts a bounded evaluation trigger", () => {
  assert.deepEqual(parseEvalTrigger(JSON.stringify(valid)), valid);
});

test("rejects duplicate, excessive, malformed, and extended triggers", () => {
  const invalid = [
    { ...valid, ids: ["J-CLOSE-01", "J-CLOSE-01"] },
    { ...valid, maxCases: 1 },
    { ...valid, maxOutputTokens: 4097 },
    { ...valid, model: "bad model with spaces" },
    { ...valid, unexpected: true },
  ];
  for (const value of invalid)
    assert.throws(() => parseEvalTrigger(JSON.stringify(value)));
  assert.throws(() => parseEvalTrigger("not-json"));
});
