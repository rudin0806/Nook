import assert from "node:assert/strict";
import test from "node:test";
import { hasExplicitCorrection } from "../src/engine/correction.ts";
import { conversationContext } from "../src/engine/conversation.ts";
import { prepareReflection } from "../src/engine/reflect.ts";
import { buildJudgeUser } from "../src/prompts/prompt-judge.ts";

const judge = {
  action: "REFLECT",
  shift_confidence: "LOW",
  medium_reason: null,
  evidence_turns: [],
  clarifications: [],
  branches: [],
  invalidate_clarifications: [],
  promote_pile_item: null,
};

test("직전 질문의 전제를 명시적으로 바로잡은 발화를 센다", () => {
  const turns = [
    {
      role: "assistant" as const,
      text: "도구가 더 있으면 넓은 구역도 관리할 수 있어요?",
    },
    {
      role: "user" as const,
      text: "도구 문제가 아니라, 매주 시간을 낼 수 있는지가 문제야.",
    },
  ];
  assert.equal(hasExplicitCorrection(turns), true);
  assert.equal(
    hasExplicitCorrection([
      { role: "assistant", text: "언제 그런 생각이 들어요?" },
      { role: "user", text: "물을 주고 돌아올 때 자주 들어" },
    ]),
    false,
  );
});

test("단순 거절의 아니와 명시적인 A가 아니라 B를 구분한다", () => {
  const assistant = {
    role: "assistant" as const,
    text: "여기까지 남기고 마칠까요?",
  };

  assert.equal(
    hasExplicitCorrection([
      assistant,
      { role: "user", text: "아니, 더 생각해볼래." },
    ]),
    false,
  );
  assert.equal(
    hasExplicitCorrection([
      assistant,
      { role: "user", text: "오늘은 아니야." },
    ]),
    false,
  );
  assert.equal(
    hasExplicitCorrection([
      { role: "assistant", text: "회비가 더 중요해요?" },
      {
        role: "user",
        text: "회비가 중요한 게 아니라 평일 저녁 시간을 낼 수 있는지가 문제야.",
      },
    ]),
    true,
  );
  assert.equal(
    hasExplicitCorrection([
      { role: "assistant", text: "공연이 싫은 거예요?" },
      { role: "user", text: "공연이 아니라 매주 연습이 부담돼." },
    ]),
    true,
  );
  assert.equal(
    hasExplicitCorrection([
      { role: "assistant", text: "공연이 싫은 거예요?" },
      { role: "user", text: "공연이 싫은 건 아니고 매주 연습이 부담돼." },
    ]),
    true,
  );
});

test("정정 표지가 있어도 직전 assistant 발화에 대한 마지막 답이 아니면 세지 않는다", () => {
  assert.equal(
    hasExplicitCorrection([
      { role: "user", text: "공연이 아니라 매주 연습이 부담돼." },
    ]),
    false,
  );
  assert.equal(
    hasExplicitCorrection([
      { role: "assistant", text: "공연이 싫은 거예요?" },
      { role: "user", text: "공연이 아니라 매주 연습이 부담돼." },
      { role: "assistant", text: "연습 일정이 걸리는군요." },
    ]),
    false,
  );
});

test("대화에서 정정 신호를 한 번 계산해 Judge 입력과 프롬프트에 싣는다", () => {
  const uuid = (n: number) =>
    `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const node = {
    id: uuid(3),
    segment_id: uuid(2),
    ordinal: 1,
    ai_proposed_text: "주말 농장 구역을 넓힐까?",
    final_text: "주말 농장 구역을 넓힐까?",
    approved_at: "2026-09-21T00:00:00Z",
  };
  const { input } = conversationContext({
    session: {
      id: uuid(1),
      status: "ACTIVE",
      storage_state: "TEMPORARY",
      past_probe_count: 0,
    },
    segment: {
      id: uuid(2),
      ordinal: 1,
      node_count: 1,
      turn_count: 2,
      branch_count: 0,
      anchor_node_id: null,
    },
    current: node,
    path: [node],
    messages: [
      {
        id: uuid(4),
        role: "ASSISTANT",
        content: "도구가 더 있으면 넓은 구역도 관리할 수 있어요?",
        kind: "REFLECTION",
        sequence_no: 1,
        segment_id: uuid(2),
        created_at: "2026-09-21T00:00:00Z",
      },
      {
        id: uuid(5),
        role: "USER",
        content: "도구 문제가 아니라, 매주 시간을 낼 수 있는지가 문제야.",
        kind: "USER_REPLY",
        sequence_no: 2,
        segment_id: uuid(2),
        created_at: "2026-09-21T00:01:00Z",
      },
    ],
    clarifications: [],
    pile: [],
    state: {
      version: 0,
      mode: "READY",
      pending: null,
      last_question_type: "PRESENT",
      detail_streak: 0,
      carryover: [],
    },
  });

  assert.equal(input.corrected_previous_frame, true);
  assert.match(buildJudgeUser(input, false), /corrected_previous_frame: true/u);
});

test("정정 신호는 Prompt D에서 이전 프레임을 닫고 중심으로 돌아가게 한다", () => {
  const prepared = prepareReflection(judge, {
    main_question: "주말 농장 구역을 넓힐까?",
    past_probe_count: 0,
    last_question_type: "PRESENT",
    last_question: "도구가 더 있으면 넓은 구역도 관리할 수 있어요?",
    stalled: false,
    confused: false,
    non_answer: false,
    corrected_previous_frame: true,
    detail_streak: 0,
    current_clarifications: [],
    turns: [
      {
        id: "A1",
        role: "assistant",
        text: "도구가 더 있으면 넓은 구역도 관리할 수 있어요?",
      },
      {
        id: "U1",
        role: "user",
        text: "도구 문제가 아니라, 매주 시간을 낼 수 있는지가 문제야.",
      },
    ],
    carryover: [],
  });

  assert.match(prepared.user, /corrected_previous_frame: true/u);
  assert.match(prepared.user, /닫은 전제를 다시 넣거나/u);
  assert.match(prepared.user, /must_return_to_center: true/u);
});
