import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  score,
  severity,
  validateFixtures,
  type Fixture,
} from "../scripts/eval-core.mts";
import { judgeOutputSchema, type JudgeOutput } from "../src/schemas/judge.ts";
import { computeHedge } from "../src/engine/hedge.ts";
const fixtures: Fixture[] = readFileSync(
  new URL("../eval/judge.jsonl", import.meta.url),
  "utf8",
)
  .trim()
  .split("\n")
  .map((l) => JSON.parse(l));
const fixture = (id: string) =>
  structuredClone(fixtures.find((f) => f.id === id)!);
const output = (): JudgeOutput => ({
  action: "REFLECT",
  shift_confidence: "MEDIUM",
  medium_reason: "SINGLE_SPONTANEOUS",
  evidence_turns: ["U3"],
  clarifications: [],
  branches: [],
  invalidate_clarifications: [],
  promote_pile_item: null,
});
test("MEDIUM requires one of three reasons, other decisions require null", () => {
  for (const reason of [
    "SINGLE_SPONTANEOUS",
    "ALL_HEDGED",
    "AI_LED_WITH_USER_MATERIAL",
  ])
    assert.ok(
      judgeOutputSchema.safeParse({ ...output(), medium_reason: reason })
        .success,
    );
  for (const reason of [null, undefined, "UNKNOWN"])
    assert.equal(
      judgeOutputSchema.safeParse({ ...output(), medium_reason: reason })
        .success,
      false,
    );
  assert.equal(
    judgeOutputSchema.safeParse({ ...output(), shift_confidence: "LOW" })
      .success,
    false,
  );
});
test("CLOSE omits confidence; missing fields and illegal action combinations fail", () => {
  const o: Partial<JudgeOutput> = {
    ...output(),
    action: "CLOSE",
    medium_reason: null,
  };
  delete o.shift_confidence;
  assert.ok(judgeOutputSchema.safeParse(o).success);
  assert.equal(
    judgeOutputSchema.safeParse({ ...o, shift_confidence: "LOW" }).success,
    false,
  );
  assert.equal(
    judgeOutputSchema.safeParse({ ...output(), action: "SHIFT" }).success,
    false,
  );
  assert.equal(
    score(fixture("J-MED-01"), { action: "REFLECT" })[0].kind,
    "SCHEMA",
  );
});
test("high-only keywords allow MEDIUM but universal keywords do not", () => {
  const f = fixture("J-MED-01");
  f.expected.clarifications.expect = "ANY";
  const o = output();
  o.clarifications = [
    { text: "어느 회사나", confidence: "MEDIUM", evidence_turns: ["U3"] },
  ];
  assert.equal(
    score(f, o).some((x) => x.kind === "CLARI_HIGH_ONLY"),
    false,
  );
  o.clarifications[0].confidence = "HIGH";
  assert.ok(score(f, o).some((x) => x.kind === "CLARI_HIGH_ONLY"));
  f.expected.clarifications.forbidden_keywords = ["금지"];
  o.clarifications[0] = {
    text: "금지",
    confidence: "MEDIUM",
    evidence_turns: ["U3"],
  };
  assert.ok(score(f, o).some((x) => x.kind === "CLARI_FORBIDDEN"));
});
test("nested evidence and exact IDs are checked", () => {
  const f = fixture("J-MED-01");
  const o = output();
  o.branches = [{ text: "질문", evidence_turns: ["U99"] }];
  o.invalidate_clarifications = ["C99"];
  assert.ok(score(f, o).some((x) => x.kind === "EXTRACTION_EVIDENCE"));
  assert.ok(score(f, o).some((x) => x.kind === "INVALIDATE"));
  assert.equal(
    judgeOutputSchema.safeParse({ ...o, promote_pile_item: "P1" }).success,
    false,
  );
});
test("MEDIUM to HIGH also counts as false positive SHIFT", () => {
  assert.deepEqual(
    severity(fixture("J-MED-01"), {
      ...output(),
      action: "SHIFT",
      shift_confidence: "HIGH",
      medium_reason: null,
    }),
    ["FALSE_POSITIVE_SHIFT", "MEDIUM_TO_HIGH"],
  );
});
test("fixture validation rejects mixed promotion accept and keyword overlap", () => {
  assert.deepEqual(validateFixtures(fixtures), []);
  const f = fixture("J-PROMO-01");
  f.expected.accept.push("REFLECT/MEDIUM");
  assert.ok(validateFixtures([f]).length);
  const m = fixture("J-MED-01");
  m.expected.clarifications.high_only_keywords = ["same"];
  m.expected.clarifications.forbidden_keywords = ["same"];
  assert.ok(validateFixtures([m]).length);
});
test("reason labels are actually scored", () => {
  const o = output();
  o.medium_reason = "ALL_HEDGED";
  assert.ok(
    score(fixture("J-MED-01"), o).some((x) => x.kind === "MEDIUM_REASON"),
  );
});
test("synthetic 0.70 and 0.75 boundary checks are arithmetic, not model gold cases", () => {
  for (const [hedged, total] of [
    [7, 10],
    [3, 4],
    [6, 8],
  ]) {
    const turns = Array.from({ length: total }, (_, i) => ({
      id: `U${i}`,
      role: "user" as const,
      text: i < hedged ? "그런 것 같아" : "확실해",
    }));
    const h = computeHedge(turns);
    assert.equal(h.ratio, hedged / total);
    assert.equal(h.hedgeSpeaker, total >= 5);
    assert.equal(h.hits.length, hedged);
  }
});
