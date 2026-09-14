import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  evaluateNodeZero,
  selectNodeFixtures,
} from "../scripts/eval-node-zero.mts";
const rows = readFileSync("eval/start.jsonl", "utf8")
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line));

test("only the established 11 generation cases are admitted", () => {
  assert.equal(selectNodeFixtures(rows).length, 11);
  assert.throws(() => selectNodeFixtures(rows.slice(1)));
  const changed = structuredClone(rows);
  changed[6].id = "ST-06";
  assert.throws(() => selectNodeFixtures(changed));
});

test("keyword failures in evidence count, semantic success is never invented", async () => {
  let calls = 0;
  const report = await evaluateNodeZero(rows, async () => {
    const row = selectNodeFixtures(rows)[calls++];
    return {
      status: "completed",
      output_text: JSON.stringify({
        question: "지금 무엇을 살펴볼까?",
        evidence_quotes: [row.input.raw_thought],
        evidence_sentence:
          calls === 1
            ? "다이어트 때문에 망설였어요."
            : "사용자가 꺼낸 표현에 근거했어요.",
      }),
    };
  });
  assert.equal(calls, 11);
  assert.equal(report.complete, true);
  assert.equal(report.automaticPass, false);
  assert.deepEqual(report.cases[0].forbiddenKeywords, ["다이어트"]);
  assert.equal(report.semanticReview, "PENDING");
});

test("invented quote stops the batch, provider error text is scrubbed", async () => {
  let calls = 0;
  const report = await evaluateNodeZero(rows, async () => {
    calls++;
    return {
      status: "completed",
      output_text: JSON.stringify({
        question: "어떻게 할까?",
        evidence_sentence: "표현을 확인했어요.",
        evidence_quotes: ["원문에 없는 인용"],
      }),
    };
  });
  assert.equal(calls, 1);
  assert.equal(report.error?.code, "NODE_ZERO_OUTPUT_INVALID");
  const failed = await evaluateNodeZero(rows, async () => {
    throw new Error("secret provider content");
  });
  assert.equal(failed.error?.code, "NODE_ZERO_PROVIDER_FAILED");
  assert.equal(
    JSON.stringify(failed).includes("secret provider content"),
    false,
  );
});
