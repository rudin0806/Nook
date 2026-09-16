import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { score, type Fixture } from "../scripts/eval-core.mts";
const fixtures = readFileSync(
  new URL("../eval/judge.jsonl", import.meta.url),
  "utf8",
)
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line) as Fixture)
  .filter((fixture) => fixture.id.startsWith("J-CLAIM-"));
function output(text: string) {
  return {
    action: "REFLECT",
    shift_confidence: "LOW",
    medium_reason: null,
    evidence_turns: [],
    clarifications: [{ text, confidence: "HIGH", evidence_turns: ["U1"] }],
    branches: [],
    invalidate_clarifications: [],
    promote_pile_item: null,
  };
}
for (const fixture of fixtures) {
  test(`${fixture.id}: accepts attributed material and rejects known fact promotion`, () => {
    assert.deepEqual(
      score(fixture, output(fixture.expected.clarifications.reference[0])),
      [],
    );
    for (const bad of fixture.expected.clarifications.forbidden_examples) {
      assert.ok(
        score(fixture, output(bad)).some(
          (failure) =>
            failure.kind === "CLARIFICATION_FORBIDDEN" ||
            failure.kind.endsWith("_FORBIDDEN"),
        ),
      );
    }
    assert.ok(
      score(fixture, { ...output(""), clarifications: [] }).some((failure) =>
        failure.kind.endsWith("_EXPECT"),
      ),
    );
  });
}
