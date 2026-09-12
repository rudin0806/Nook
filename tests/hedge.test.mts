import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  calculateHedgeStats,
  hasHedgeEnding,
  type HedgeTurn,
} from "../src/engine/hedge.ts";

const users = (texts: string[]): HedgeTurn[] =>
  texts.map((text, i) => ({ id: `U${i + 1}`, role: "user", text }));

test("empty history has a finite zero ratio", () => {
  assert.deepEqual(calculateHedgeStats([]), {
    userTurnCount: 0,
    hedgedTurnCount: 0,
    hedgeRatio: 0,
    hedgeSpeaker: false,
  });
});
test("requires at least five user turns, regardless of assistant turns", () => {
  const turns = users(Array(4).fill("그런 것 같아"));
  turns.push({ id: "A1", role: "assistant", text: "어떤 때예요?" });
  assert.equal(calculateHedgeStats(turns).hedgeSpeaker, false);
  turns.push({ id: "U5", role: "user", text: "맞아" });
  assert.equal(calculateHedgeStats(turns).hedgeRatio, 0.8);
  assert.equal(calculateHedgeStats(turns).hedgeSpeaker, true);
});
test("threshold includes exactly 0.7 and excludes values below it", () => {
  assert.equal(
    calculateHedgeStats(
      users([...Array(7).fill("그런 것 같아"), ...Array(3).fill("맞아")]),
    ).hedgeSpeaker,
    true,
  );
  assert.equal(
    calculateHedgeStats(
      users([...Array(6).fill("그런 것 같아"), ...Array(4).fill("맞아")]),
    ).hedgeSpeaker,
    false,
  );
});
test("counts endings, not an earlier softened clause or the assistant", () => {
  assert.equal(hasHedgeEnding("그런 것 같아. 아니, 확실해."), false);
  assert.equal(hasHedgeEnding("그런 것 같아！？  "), true);
  assert.equal(hasHedgeEnding(""), false);
  assert.equal(
    calculateHedgeStats([{ id: "A1", role: "assistant", text: "그런 것 같아" }])
      .hedgedTurnCount,
    0,
  );
});
test("rejects overlapping history so it cannot inflate the ratio", () => {
  const turn = users(["그런 것 같아"])[0];
  assert.throws(() => calculateHedgeStats([turn, turn]), /DUPLICATE_TURN_ID/);
});

const fixtures = readFileSync(
  new URL("../eval/judge.jsonl", import.meta.url),
  "utf8",
)
  .trim()
  .split("\n")
  .map(
    (line) =>
      JSON.parse(line) as {
        id: string;
        input: { turns: HedgeTurn[] };
        fixture_meta: { history: HedgeTurn[]; expected_hedge_speaker: boolean };
      },
  );
test("all 32 supplied Judge fixtures match the shared calculation", () => {
  assert.equal(fixtures.length, 32);
  for (const row of fixtures) {
    const result = calculateHedgeStats([
      ...row.fixture_meta.history,
      ...row.input.turns,
    ]);
    assert.equal(
      result.hedgeSpeaker,
      row.fixture_meta.expected_hedge_speaker,
      row.id,
    );
    if (row.id === "J-HEDGE-01a") assert.equal(result.hedgeRatio, 5 / 6);
    if (row.id === "J-HEDGE-01b") assert.equal(result.hedgeRatio, 2 / 6);
  }
});
