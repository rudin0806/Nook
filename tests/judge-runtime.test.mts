import assert from "node:assert/strict";
import test from "node:test";
import { prepareJudge } from "../src/engine/judge.ts";
import type { JudgeInput, JudgeTurn } from "../src/schemas/judge.ts";

const turns: JudgeTurn[] = [
  { id: "U1", role: "user", text: "처음엔 그런 것 같아" },
  { id: "A1", role: "assistant", text: "어떤 때 그래요?" },
  { id: "U2", role: "user", text: "아침인 것 같아" },
  { id: "A2", role: "assistant", text: "또 언제 그래요?" },
  { id: "U3", role: "user", text: "회의 뒤인 것 같아" },
  { id: "A3", role: "assistant", text: "무엇이 달라요?" },
  { id: "U4", role: "user", text: "반응이 없는 것 같아" },
  { id: "A4", role: "assistant", text: "최근에도 그랬어요?" },
  { id: "U5", role: "user", text: "어제도 그런 것 같아" },
];

const input = (): JudgeInput => ({
  main_question: "이 일을 계속할까?",
  main_path: ["이 일을 계속할까?"],
  pile: [{ id: "P1", text: "다른 일을 알아볼까?" }],
  current_clarifications: [
    { id: "C1", text: "아침에 생각이 남", confidence: "HIGH" },
  ],
  carryover: [
    {
      turn: "U3",
      text: "회의 뒤인 것 같아",
      judged: "MEDIUM",
      medium_reason: "SINGLE_SPONTANEOUS",
    },
  ],
  corrected_previous_frame: false,
  turns: [turns[7], turns[8]],
});

const config = {
  model: "gpt-5.6-sol",
  reasoningEffort: "high",
  maxOutputTokens: 2_048,
};

const lowOutput = () => ({
  action: "REFLECT",
  shift_confidence: "LOW",
  medium_reason: null,
  evidence_turns: [],
  clarifications: [],
  branches: [],
  invalidate_clarifications: [],
  promote_pile_item: null,
});

test("prepares a bounded non-persistent request without leaking history", () => {
  const prepared = prepareJudge(input(), turns, config);
  const serialized = JSON.stringify(prepared.request);
  assert.equal(prepared.hedgeSpeaker, true);
  assert.ok(serialized.includes("hedge_speaker: true"));
  assert.ok(serialized.includes("corrected_previous_frame: false"));
  assert.ok(serialized.includes("U5"));
  assert.ok(!serialized.includes("처음엔 그런 것 같아"));
  assert.equal(prepared.request.store, false);
  assert.equal(prepared.request.model, "gpt-5.6-sol");
  assert.deepEqual(prepared.request.reasoning, { effort: "high" });
  assert.equal(prepared.request.max_output_tokens, 2_048);
});

test("defaults the correction signal and forwards an explicit correction", () => {
  const withoutSignal: Partial<JudgeInput> = { ...input() };
  delete withoutSignal.corrected_previous_frame;
  const defaulted = prepareJudge(withoutSignal, turns, config);
  assert.match(
    defaulted.request.input[0].content[0].text,
    /corrected_previous_frame: false/u,
  );

  const corrected = prepareJudge(
    { ...input(), corrected_previous_frame: true },
    turns,
    config,
  );
  assert.match(
    corrected.request.input[0].content[0].text,
    /corrected_previous_frame: true/u,
  );
  assert.match(corrected.request.instructions, /가치가 높은\s+사용자 재료/u);
  assert.match(corrected.request.instructions, /action을 고정하지 말고/u);
  assert.match(corrected.request.instructions, /거부한 전제 A는 폐기한다/u);
});

test("requires the prompt window to match the server-owned session turns", () => {
  const changed = input();
  changed.turns[1] = { ...changed.turns[1], text: "바뀐 원문" };
  assert.throws(
    () => prepareJudge(changed, turns, config),
    /JUDGE_CONTEXT_MISMATCH/,
  );
  assert.throws(
    () => prepareJudge(input(), [...turns, turns[0]], config),
    /JUDGE_SESSION_TURNS_INVALID/,
  );

  const stale = input();
  stale.turns = [turns[5], turns[6]];
  assert.throws(
    () => prepareJudge(stale, turns, config),
    /JUDGE_CONTEXT_MISMATCH/,
  );
});

test("requires carryover to match an earlier server-owned user turn", () => {
  const changed = input();
  changed.carryover[0].text = "위조된 과거 발화";
  assert.throws(
    () => prepareJudge(changed, turns, config),
    /JUDGE_CARRYOVER_MISMATCH/,
  );

  const duplicate = input();
  duplicate.carryover = [
    {
      turn: "U5",
      text: "어제도 그런 것 같아",
      judged: "MEDIUM",
      medium_reason: "SINGLE_SPONTANEOUS",
    },
  ];
  assert.throws(
    () => prepareJudge(duplicate, turns, config),
    /JUDGE_CARRYOVER_MISMATCH/,
  );
});

test("validates model output against evidence and referenced input IDs", () => {
  const prepared = prepareJudge(input(), turns, config);
  assert.deepEqual(
    prepared.validateResponseText(JSON.stringify(lowOutput())),
    lowOutput(),
  );
  assert.throws(
    () =>
      prepared.validateOutput({
        ...lowOutput(),
        action: "SHIFT",
        shift_confidence: "HIGH",
        evidence_turns: ["U99"],
      }),
    /JUDGE_EVIDENCE_UNAVAILABLE/,
  );
  assert.throws(
    () =>
      prepared.validateOutput({
        ...lowOutput(),
        invalidate_clarifications: ["C99"],
      }),
    /JUDGE_CLARIFICATION_UNAVAILABLE/,
  );
  assert.throws(
    () =>
      prepared.validateOutput({
        ...lowOutput(),
        action: "SHIFT",
        shift_confidence: "HIGH",
        evidence_turns: ["U5"],
        promote_pile_item: "P99",
      }),
    /JUDGE_PILE_ITEM_UNAVAILABLE/,
  );
});

test("rejects unapproved models, reasoning values, output caps, and malformed JSON", () => {
  assert.throws(
    () => prepareJudge(input(), turns, { ...config, model: "gpt-6-astra" }),
    /MODEL_NOT_ALLOWED/,
  );
  assert.throws(
    () => prepareJudge(input(), turns, { ...config, reasoningEffort: "xhigh" }),
    /REASONING_EFFORT_NOT_ALLOWED/,
  );
  assert.throws(
    () => prepareJudge(input(), turns, { ...config, maxOutputTokens: 2_049 }),
    /JUDGE_OUTPUT_LIMIT_INVALID/,
  );
  const prepared = prepareJudge(input(), turns, config);
  assert.throws(
    () => prepared.validateResponseText("not-json"),
    /JUDGE_OUTPUT_INVALID/,
  );
});
