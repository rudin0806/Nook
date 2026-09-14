import assert from "node:assert/strict";
import test from "node:test";
import { prepareReframe, executeReframe } from "../src/engine/reframe.ts";
const options = { model: "gpt-5.6-sol", reasoningEffort: "high" };
const session = [
  { id: "U1", role: "user", text: "新しい仕事をしたい" },
  { id: "A1", role: "assistant", text: "어떤 일을 하고 싶어요?" },
  { id: "U2", role: "user", text: "지금은 같은 일만 맡고 있어요" },
];
const input = () => ({
  main_question: "이직할까?",
  main_path: ["이직할까?"],
  pile: [{ id: "P1", text: "OLD_SAVED_QUESTION" }],
  current_clarifications: [],
  turns: session.slice(1),
  carryover: [
    {
      turn: "U1",
      text: session[0].text,
      judged: "MEDIUM",
      medium_reason: "SINGLE_SPONTANEOUS",
    },
  ],
});
const judge = () => ({
  action: "SHIFT",
  shift_confidence: "HIGH",
  medium_reason: null,
  evidence_turns: ["U1", "U2"],
  clarifications: [],
  branches: [],
  invalidate_clarifications: [],
  promote_pile_item: null,
});
const valid = JSON.stringify({
  question: "지금 회사에서 새로운 일을 해볼 수 있을까?",
  evidence_sentence: "같은 일만 맡는다고 말했어요.",
});

test("REFLECT LOW/MEDIUM and CLOSE never invoke transport", async () => {
  let calls = 0;
  const transport = async () => {
    calls++;
    return { status: "completed", output_text: valid };
  };
  for (const j of [
    {
      ...judge(),
      action: "REFLECT",
      shift_confidence: "LOW",
      evidence_turns: [],
    },
    {
      ...judge(),
      action: "REFLECT",
      shift_confidence: "MEDIUM",
      medium_reason: "SINGLE_SPONTANEOUS",
    },
    {
      action: "CLOSE",
      medium_reason: null,
      evidence_turns: [],
      clarifications: [],
      branches: [],
      invalidate_clarifications: [],
      promote_pile_item: null,
    },
  ]) {
    await assert.rejects(
      executeReframe(j, input(), session, options, transport),
      /REFRAME_SHIFT_REQUIRED/,
    );
  }
  assert.equal(calls, 0);
});
test("evidence resolves carryover in Judge order and keeps promotion server-side", () => {
  const prepared = prepareReframe(
    { ...judge(), promote_pile_item: "P1" },
    input(),
    session,
    options,
  );
  const payload = JSON.parse(prepared.request.input[0].content[0].text);
  assert.deepEqual(payload.evidence, [
    { id: "U1", text: session[0].text },
    { id: "U2", text: session[2].text },
  ]);
  assert.ok(!JSON.stringify(payload).includes("OLD_SAVED_QUESTION"));
  assert.deepEqual(prepared.provenance, {
    evidenceTurnIds: ["U1", "U2"],
    promotedBranchId: "P1",
  });
  assert.equal(prepared.request.store, false);
});
test("unknown, assistant, altered and duplicate evidence cannot reach model", async () => {
  let calls = 0;
  const transport = async () => {
    calls++;
    return { status: "completed", output_text: valid };
  };
  for (const ids of [["U99"], ["A1"], ["U1", "U1"]])
    await assert.rejects(
      executeReframe(
        { ...judge(), evidence_turns: ids },
        input(),
        session,
        options,
        transport,
      ),
    );
  const c = input();
  c.carryover[0].text = "FORGED";
  await assert.rejects(
    executeReframe(judge(), c, session, options, transport),
    /CARRYOVER/,
  );
  const c2 = input();
  c2.turns = [{ ...session[2], text: "FORGED" }];
  await assert.rejects(
    executeReframe(judge(), c2, session, options, transport),
    /CONTEXT/,
  );
  assert.equal(calls, 0);
});
test("rejects extra fields, duplicate questions and malformed output", () => {
  const p = prepareReframe(judge(), input(), session, options);
  for (const v of [
    "not json",
    JSON.stringify({
      question: "질문?",
      evidence_sentence: "근거",
      lead_in: "추가",
    }),
    JSON.stringify({ question: "이직 할까？", evidence_sentence: "근거" }),
    JSON.stringify({
      question: "첫 질문? 둘째 질문?",
      evidence_sentence: "근거",
    }),
  ])
    assert.throws(() => p.validateResponseText(v));
  assert.equal(
    p.validateResponseText(valid).question,
    JSON.parse(valid).question,
  );
});
test("provider and incomplete failures do not retry or leak raw data", async () => {
  let calls = 0;
  await assert.rejects(
    executeReframe(judge(), input(), session, options, async () => {
      calls++;
      throw new Error("PRIVATE_TEXT");
    }),
    /^Error: REFRAME_PROVIDER_FAILED$/,
  );
  assert.equal(calls, 1);
  await assert.rejects(
    executeReframe(judge(), input(), session, options, async () => ({
      status: "incomplete",
      output_text: valid,
    })),
    /INCOMPLETE/,
  );
});
test("successful response returns proposal only; forbidden models block transport", async () => {
  const r = await executeReframe(
    judge(),
    input(),
    session,
    options,
    async () => ({
      status: "completed",
      output_text: valid,
      usage: { input_tokens: 10, output_tokens: 8 },
    }),
  );
  assert.equal(r.metadata.inputTokens, 10);
  assert.deepEqual(r.output, JSON.parse(valid));
  for (const model of ["gpt-6-astra", "gpt-5.6-luna"])
    assert.throws(
      () => prepareReframe(judge(), input(), session, { ...options, model }),
      /MODEL_NOT_ALLOWED/,
    );
});
