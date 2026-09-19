import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  evaluate,
  passed,
  validateFixtures,
} from "../scripts/eval-start-safety.mts";
import { MODERATION_CATEGORIES } from "../src/engine/moderation.ts";

const readRows = (path: string): unknown[] =>
  readFileSync(path, "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
const safety = readRows("eval/safety.jsonl");
const start = readRows("eval/start.jsonl");
const fixtures = validateFixtures(safety, start);
const moderation = {
  results: [
    {
      flagged: false,
      categories: Object.fromEntries(
        MODERATION_CATEGORIES.map((key) => [key, false]),
      ),
    },
  ],
};

test("rejects duplicate fixtures and derived mapping drift before calls", () => {
  assert.throws(() =>
    validateFixtures([safety[0], ...safety.slice(0, 14)], start),
  );
  const changed = structuredClone(safety) as {
    expected: { contact: string };
  }[];
  changed[0].expected.contact = "999";
  assert.throws(
    () => validateFixtures(changed, start),
    /FIXTURE_MAPPING_INVALID/,
  );
});

test("scores misrouting separately and never includes raw text in report", async () => {
  let calls = 0;
  const report = await evaluate(fixtures, {
    moderate: async () => moderation,
    classify: async (request) => {
      calls++;
      const sent = request.input[0].content[0].text;
      assert.ok(sent.startsWith("Return only a JSON object.\n"));
      const input = JSON.parse(sent.slice(sent.indexOf("\n") + 1));
      if ("utterance" in input) {
        const row = fixtures.safety.find(
          (row) => row.input.utterance === input.utterance,
        )!;
        const result =
          row.id === "S-07"
            ? { label: "NONE", category: "NONE" }
            : { label: row.expected.label, category: row.expected.category };
        return { status: "completed", output_text: JSON.stringify(result) };
      }
      const row = fixtures.start.find(
        (row) => row.input.raw_thought === input.raw_thought,
      )!;
      return {
        status: "completed",
        output_text: JSON.stringify({
          label: row.expected.label,
          focus_required: false,
          focus_question: null,
          focus_candidates: [],
          info_guidance:
            row.expected.label === "NEEDS_INFO"
              ? "관련 정보를 확인해주세요."
              : null,
        }),
      };
    },
  });
  assert.equal(calls, 32);
  assert.equal(report.complete, true);
  assert.equal(report.safety.labelCorrect, 14);
  assert.equal(report.safety.stopToContinue, 1);
  assert.equal(report.safety.continueToStop, 0);
  assert.equal(report.start.labelCorrect, 17);
  assert.equal(passed(report), false);
  const serialized = JSON.stringify(report);
  for (const row of fixtures.safety)
    assert.equal(serialized.includes(row.input.utterance), false);
  for (const row of fixtures.start)
    assert.equal(serialized.includes(row.input.raw_thought), false);
});

test("provider failure stops both suites without retry or leaking error", async () => {
  let calls = 0;
  const report = await evaluate(fixtures, {
    moderate: async () => {
      calls++;
      throw new Error("private provider response");
    },
    classify: async () => {
      throw new Error("must not run");
    },
  });
  assert.equal(calls, 1);
  assert.equal(report.complete, false);
  assert.equal(report.start.evaluated, 0);
  assert.deepEqual(report.error, {
    id: "S-01",
    stage: "SAFETY",
    code: "MODERATION_PROVIDER_FAILED",
  });
  assert.equal(
    JSON.stringify(report).includes("private provider response"),
    false,
  );
});
