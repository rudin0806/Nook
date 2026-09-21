import assert from "node:assert/strict";
import test from "node:test";
import { hasExplicitCorrection } from "../src/engine/correction.ts";
import { prepareReflection } from "../src/engine/reflect.ts";

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
      text: "남자친구가 여행을 가도 괜찮으려면 뭐가 있어야 해요?",
    },
    {
      role: "user" as const,
      text: "뭐가 있어도 되는 게 아니라. 난 남자친구가 나를 더 소중하게 느끼길 바라는 거야.",
    },
  ];
  assert.equal(hasExplicitCorrection(turns), true);
  assert.equal(
    hasExplicitCorrection([
      { role: "assistant", text: "언제 그런 생각이 들어요?" },
      { role: "user", text: "퇴근하고 집에 올 때 자주 들어" },
    ]),
    false,
  );
});

test("정정 신호는 Prompt D에서 이전 프레임을 닫고 중심으로 돌아가게 한다", () => {
  const prepared = prepareReflection(judge, {
    main_question: "남자친구에게 서운한 걸 어떻게 말할까?",
    past_probe_count: 0,
    last_question_type: "PRESENT",
    last_question: "남자친구가 여행을 가도 괜찮으려면 뭐가 있어야 해요?",
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
        text: "남자친구가 여행을 가도 괜찮으려면 뭐가 있어야 해요?",
      },
      {
        id: "U1",
        role: "user",
        text: "뭐가 있어도 되는 게 아니라. 난 남자친구가 나를 더 소중하게 느끼길 바라는 거야.",
      },
    ],
    carryover: [],
  });

  assert.match(prepared.user, /corrected_previous_frame: true/u);
  assert.match(prepared.user, /닫은 전제를 다시 넣거나/u);
  assert.match(prepared.user, /must_return_to_center: true/u);
});
