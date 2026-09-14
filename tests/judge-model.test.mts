import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  evaluateJudge,
  formatProviderDiagnostic,
  makeJudgeRequest,
  selectFixtures,
  type ModelResponse,
} from "../scripts/judge-model.mts";
import type { Fixture } from "../scripts/eval-core.mts";
const all: Fixture[] = readFileSync(
  new URL("../eval/judge.jsonl", import.meta.url),
  "utf8",
)
  .trim()
  .split("\n")
  .map((l) => JSON.parse(l));
const get = (id: string) => structuredClone(all.find((f) => f.id === id)!);
const output = (action = "CLOSE") => ({
  action,
  ...(action === "CLOSE" ? {} : { shift_confidence: "HIGH" }),
  medium_reason: null,
  evidence_turns: ["U3"],
  clarifications: [],
  branches: [],
  invalidate_clarifications: [],
  promote_pile_item: null,
});
const response = (out: unknown): ModelResponse => ({
  status: "completed",
  output_text: JSON.stringify(out),
  model: "test-model",
  usage: { input_tokens: 10, output_tokens: 5 },
});
test("history and gold data do not leak; no persistence and output cap", () => {
  const f = get("J-HEDGE-01a");
  f.rationale = "GOLD_MARKER";
  f.fixture_meta.history[0].text =
    "SECRET_HISTORY " + f.fixture_meta.history[0].text;
  const r = makeJudgeRequest(f, "test-model", 1024);
  const serializedInput = JSON.stringify(r.input);
  assert.deepEqual(r.input[0].role, "user");
  assert.deepEqual(r.input[0].content[0].type, "input_text");
  assert.ok(!serializedInput.includes("GOLD_MARKER"));
  assert.ok(!serializedInput.includes("SECRET_HISTORY"));
  assert.ok(serializedInput.includes("hedge_speaker: true"));
  assert.ok(serializedInput.includes("JSON"));
  assert.equal(r.store, false);
  assert.equal(r.max_output_tokens, 1024);
  assert.deepEqual(r.reasoning, { effort: "medium" });
});
test("unknown IDs, duplicates and excessive case counts fail before calls", () => {
  assert.throws(() => selectFixtures(all, ["BAD"], 2));
  assert.throws(() => selectFixtures(all, ["J-CLOSE-01", "J-CLOSE-01"], 2));
  assert.throws(() => selectFixtures(all, ["J-CLOSE-01", "J-EDGE-01"], 1));
});
test("fixture mismatch blocks every model call", async () => {
  const f = get("J-HEDGE-01a");
  f.fixture_meta.expected_hedge_speaker = false;
  let calls = 0;
  await assert.rejects(
    evaluateJudge([f], "test", 1024, async () => {
      calls++;
      return response(output());
    }),
  );
  assert.equal(calls, 0);
});
test("MEDIUM to HIGH counts both severity errors and captures usage", async () => {
  const r = await evaluateJudge([get("J-MED-01")], "test", 1024, async () =>
    response(output("SHIFT")),
  );
  assert.equal(r.errors.FALSE_POSITIVE_SHIFT, 1);
  assert.equal(r.errors.MEDIUM_TO_HIGH, 1);
  assert.equal(r.cases[0].inputTokens, 10);
});
test("report keeps safe structural output without raw generated text", async () => {
  const f = get("J-MED-01");
  const result = await evaluateJudge([f], "test", 1024, async () =>
    response({
      action: "REFLECT",
      shift_confidence: "MEDIUM",
      medium_reason: "SINGLE_SPONTANEOUS",
      evidence_turns: ["U3"],
      clarifications: [
        {
          text: "SECRET_GENERATED_TEXT",
          confidence: "MEDIUM",
          evidence_turns: ["U3"],
        },
      ],
      branches: [],
      invalidate_clarifications: [],
      promote_pile_item: null,
    }),
  );
  assert.equal(result.cases[0].mediumReason, "SINGLE_SPONTANEOUS");
  assert.deepEqual(result.cases[0].evidenceTurns, ["U3"]);
  assert.equal(result.cases[0].clarificationCount, 1);
  assert.equal(result.cases[0].branchCount, 0);
  assert.ok(!JSON.stringify(result).includes("SECRET_GENERATED_TEXT"));
});
test("malformed or incomplete outputs fail rather than count as a pass", async () => {
  for (const r of [
    { status: "incomplete", output_text: "{}" },
    { status: "completed", output_text: "not-json" },
    response({ action: "CLOSE" }),
  ]) {
    const report = await evaluateJudge(
      [get("J-CLOSE-01")],
      "test",
      1024,
      async () => r,
    );
    assert.equal(report.strict.passed, 0);
    assert.equal(report.cases[0].failures.length, 1);
  }
});
test("provider failure stops further requests and never leaks the error", async () => {
  let calls = 0;
  const diagnostics: string[] = [];
  const r = await evaluateJudge(
    [get("J-CLOSE-01"), get("J-EDGE-01")],
    "test",
    1024,
    async () => {
      calls++;
      throw Error("SECRET_PROVIDER_DATA");
    },
    (error) => diagnostics.push(formatProviderDiagnostic(error)),
  );
  assert.equal(calls, 1);
  assert.equal(r.complete, false);
  assert.ok(!JSON.stringify(r).includes("SECRET_PROVIDER_DATA"));
  assert.deepEqual(diagnostics, ["OPENAI_API_ERROR"]);
});
test("provider diagnostics expose allowlisted metadata but never messages", () => {
  const diagnostic = formatProviderDiagnostic({
    status: 400,
    code: "invalid_request_error",
    type: "invalid_request_error",
    param: "text.format",
    message: "SECRET_PROVIDER_DATA",
  });
  assert.equal(
    diagnostic,
    "OPENAI_API_ERROR status=400 code=invalid_request_error type=invalid_request_error param=text.format",
  );
  assert.ok(!diagnostic.includes("SECRET_PROVIDER_DATA"));
  assert.equal(
    formatProviderDiagnostic({ code: "unsafe value with spaces" }),
    "OPENAI_API_ERROR",
  );
});
test("provider diagnostics classify messages without exposing them", () => {
  const diagnostic = formatProviderDiagnostic({
    status: 400,
    type: "invalid_request_error",
    param: "input",
    message: "Input content was flagged by the safety policy: SECRET_DETAIL",
  });
  assert.equal(
    diagnostic,
    "OPENAI_API_ERROR status=400 type=invalid_request_error param=input category=INPUT_POLICY",
  );
  assert.ok(!diagnostic.includes("SECRET_DETAIL"));
});
test("boundary cases do not enter strict denominator", async () => {
  const r = await evaluateJudge([get("J-SHIFT-04")], "test", 1024, async () =>
    response(output("SHIFT")),
  );
  assert.equal(r.strict.total, 0);
  assert.equal(r.cases.length, 1);
});
