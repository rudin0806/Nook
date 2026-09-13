import assert from "node:assert/strict";
import test from "node:test";
import {
  prepareReflection,
  inspectReflectionQuestion,
} from "../src/engine/reflect.ts";
const context = () => ({
  main_question: "이직할까?",
  past_probe_count: 0,
  last_question_type: null,
  current_clarifications: [],
  turns: [
    { id: "U1", role: "user", text: "어느 회사나 비슷하지 않나 싶기도 해" },
  ],
  carryover: [],
});
const judge = () => ({
  action: "REFLECT",
  shift_confidence: "MEDIUM",
  medium_reason: "SINGLE_SPONTANEOUS",
  evidence_turns: ["U1"],
  clarifications: [],
  branches: [],
  invalidate_clarifications: [],
  promote_pile_item: null,
});
test("SHIFT and CLOSE cannot prepare Prompt D", () => {
  assert.throws(
    () =>
      prepareReflection(
        {
          ...judge(),
          action: "SHIFT",
          shift_confidence: "HIGH",
          medium_reason: null,
        },
        context(),
      ),
    /REFLECT_REQUIRED/,
  );
  const close = { ...judge(), action: "CLOSE", medium_reason: null };
  delete (close as Partial<typeof close>).shift_confidence;
  assert.throws(() => prepareReflection(close, context()), /REFLECT_REQUIRED/);
});
test("all three MEDIUM reasons are passed verbatim", () => {
  for (const medium_reason of [
    "SINGLE_SPONTANEOUS",
    "ALL_HEDGED",
    "AI_LED_WITH_USER_MATERIAL",
  ])
    assert.ok(
      prepareReflection({ ...judge(), medium_reason }, context()).user.includes(
        `medium_reason: ${medium_reason}`,
      ),
    );
  assert.throws(() =>
    prepareReflection({ ...judge(), medium_reason: null }, context()),
  );
});
test("LOW is explicitly conveyed without inventing MEDIUM reason", () => {
  const r = prepareReflection(
    {
      ...judge(),
      shift_confidence: "LOW",
      medium_reason: null,
      evidence_turns: [],
    },
    context(),
  );
  assert.ok(r.user.includes("REFLECT/LOW"));
  assert.ok(!r.user.includes("medium_reason:"));
});
test("PAST is blocked by used quota or immediately preceding PAST", () => {
  for (const c of [
    { ...context(), past_probe_count: 1 },
    { ...context(), last_question_type: "PAST" },
  ]) {
    const r = prepareReflection(judge(), c);
    assert.ok(r.user.includes("past_allowed: false"));
    assert.throws(
      () =>
        r.validateOutput({ question: "전에 그런 적 있어요?", type: "PAST" }),
      /PAST_NOT_ALLOWED/,
    );
    assert.equal(
      r.validateOutput({
        question: "그때와 지금은 뭐가 달라요?",
        type: "COMPARE",
      }).type,
      "COMPARE",
    );
  }
  assert.equal(
    prepareReflection(judge(), context()).validateOutput({
      question: "전에 산 것이 있어요?",
      type: "PAST",
    }).type,
    "PAST",
  );
});
test("no Node 0 and malformed output cannot enter regular reflection", () => {
  assert.throws(() =>
    prepareReflection(judge(), { ...context(), main_question: "" }),
  );
  const r = prepareReflection(judge(), context());
  for (const out of [
    { question: "", type: "PRESENT" },
    { question: "언제예요?", type: "OTHER" },
    { question: "언제예요?", type: "PRESENT", lead_in: "그렇군요" },
  ])
    assert.throws(() => r.validateOutput(out));
});
test("missing, assistant or overlapping evidence is rejected", () => {
  assert.throws(
    () => prepareReflection({ ...judge(), evidence_turns: ["U99"] }, context()),
    /EVIDENCE_UNAVAILABLE/,
  );
  assert.throws(() =>
    prepareReflection({ ...judge(), evidence_turns: ["A1"] }, context()),
  );
  assert.throws(
    () =>
      prepareReflection(judge(), {
        ...context(),
        carryover: [{ turn: "U1", text: "duplicate" }],
      }),
    /DUPLICATE_TURN_ID/,
  );
});
test("explicit carryover evidence text is delivered without full history", () => {
  const r = prepareReflection(
    { ...judge(), evidence_turns: ["U0", "U1"] },
    { ...context(), carryover: [{ turn: "U0", text: "앞선 사용자 표현" }] },
  );
  assert.ok(r.user.includes("앞선 사용자 표현"));
  assert.ok(r.user.includes("U0, U1"));
});
test("keyword diagnostics do not reject legitimate frequency question D-08", () => {
  assert.deepEqual(
    inspectReflectionQuestion("야간 대응은 얼마나 자주 해요?"),
    [],
  );
  assert.deepEqual(inspectReflectionQuestion("언제예요? 어떻게 해요?"), [
    "MULTIPLE_QUESTION_MARKS",
  ]);
  assert.deepEqual(inspectReflectionQuestion("어떻게 될 것 같아요?"), [
    "HEDGE_INDUCING_ENDING",
  ]);
  // No flags is not proof of semantic compliance.
});
