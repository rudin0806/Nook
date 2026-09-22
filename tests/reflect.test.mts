import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveReflectOutputPolicy,
  inspectReflectionQuestion,
  prepareReflection,
  ReflectionCenterRequiredError,
} from "../src/engine/reflect.ts";
import {
  REFLECT_MODE_PROMPTS,
  REFLECT_SYSTEM,
} from "../src/prompts/prompt-reflect.ts";

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

const mediumJudge = () => ({
  action: "REFLECT",
  shift_confidence: "MEDIUM",
  medium_reason: "SINGLE_SPONTANEOUS",
  evidence_turns: ["U1"],
  clarifications: [],
  branches: [],
  invalidate_clarifications: [],
  promote_pile_item: null,
});

const lowJudge = () => ({
  ...mediumJudge(),
  shift_confidence: "LOW",
  medium_reason: null,
  evidence_turns: [],
});

const output = (overrides: Record<string, unknown> = {}) => ({
  scope: "CENTER",
  move: "CONNECT",
  question: "그래도 이직 생각이 나는 건 언제예요?",
  type: "PRESENT",
  source_turn: "U1",
  source_quote: "비슷하지 않나 싶기도 해",
  ...overrides,
});

test("SHIFT and CLOSE cannot prepare Prompt D", () => {
  assert.throws(
    () =>
      prepareReflection(
        {
          ...mediumJudge(),
          action: "SHIFT",
          shift_confidence: "HIGH",
          medium_reason: null,
        },
        context(),
      ),
    /REFLECT_REQUIRED/,
  );
  const close = { ...mediumJudge(), action: "CLOSE", medium_reason: null };
  delete (close as Partial<typeof close>).shift_confidence;
  assert.throws(() => prepareReflection(close, context()), /REFLECT_REQUIRED/);
});

test("Prompt D has one compact common contract and one selected mode prompt", () => {
  assert.ok(REFLECT_SYSTEM.length < 6_000);
  const prepared = prepareReflection(lowJudge(), context());
  assert.equal(prepared.mode, "DEFAULT");
  assert.ok(prepared.user.includes(REFLECT_MODE_PROMPTS.DEFAULT));
  for (const mode of [
    "MEDIUM",
    "CORRECTION",
    "CONFUSED",
    "NON_ANSWER",
    "RETURN_CENTER",
  ] as const) {
    assert.ok(!prepared.user.includes(REFLECT_MODE_PROMPTS[mode]));
  }
  assert.match(REFLECT_SYSTEM, /것 같아요\?/u);
  assert.match(REFLECT_SYSTEM, /다시 가능한 선택지로 뒤집지 않는다/u);
  assert.match(REFLECT_SYSTEM, /어떻게 저울질돼요/u);
  assert.match(REFLECT_SYSTEM, /힘든 사건.*move는 CONNECT/u);
  assert.match(REFLECT_SYSTEM, /어떤 마음\/기분이 들어요.*묻지 않고/u);
  assert.match(REFLECT_MODE_PROMPTS.CORRECTION, /새로 만들지 않는다/u);
  assert.match(REFLECT_MODE_PROMPTS.MEDIUM, /중립적인 허용 범위·조건/u);
  assert.match(REFLECT_MODE_PROMPTS.MEDIUM, /바꿀 수 있다면/u);
});

test("reflection mode priority is deterministic", () => {
  const allSignals = {
    ...context(),
    corrected_previous_frame: true,
    confused: true,
    non_answer: true,
    stalled: true,
    detail_streak: 2,
  };
  const cases = [
    [allSignals, "CORRECTION"],
    [{ ...allSignals, corrected_previous_frame: false }, "CONFUSED"],
    [
      { ...allSignals, corrected_previous_frame: false, confused: false },
      "NON_ANSWER",
    ],
    [
      {
        ...allSignals,
        corrected_previous_frame: false,
        confused: false,
        non_answer: false,
      },
      "RETURN_CENTER",
    ],
    [{ ...context(), detail_streak: 2 }, "RETURN_CENTER"],
    [context(), "MEDIUM"],
  ] as const;

  for (const [rawContext, expected] of cases) {
    const prepared = prepareReflection(mediumJudge(), rawContext);
    assert.equal(prepared.mode, expected);
    assert.equal(
      prepared.mustReturnToCenter,
      ["CORRECTION", "CONFUSED", "NON_ANSWER", "RETURN_CENTER"].includes(
        expected,
      ),
    );
    assert.ok(prepared.user.includes(`mode: ${expected}`));
  }

  assert.equal(prepareReflection(lowJudge(), context()).mode, "DEFAULT");
});

test("all three MEDIUM reasons are passed verbatim", () => {
  for (const medium_reason of [
    "SINGLE_SPONTANEOUS",
    "ALL_HEDGED",
    "AI_LED_WITH_USER_MATERIAL",
  ]) {
    const prepared = prepareReflection(
      { ...mediumJudge(), medium_reason },
      context(),
    );
    assert.equal(prepared.mode, "MEDIUM");
    assert.ok(prepared.user.includes(`medium_reason: ${medium_reason}`));
  }
  assert.throws(() =>
    prepareReflection({ ...mediumJudge(), medium_reason: null }, context()),
  );
});

test("output policy narrows medium reasons and common recovery traps", () => {
  const turns = [{ role: "user" as const, text: "조금 걸리는 것 같아" }];
  assert.deepEqual(
    deriveReflectOutputPolicy("MEDIUM", "SINGLE_SPONTANEOUS", {
      last_question: "다른 조건은 어때요?",
      turns,
    }),
    {
      requiredScope: "CENTER",
      allowedMoves: ["CONNECT", "COUNTERWEIGHT"],
      reason: "MEDIUM_SINGLE",
    },
  );
  assert.deepEqual(
    deriveReflectOutputPolicy("MEDIUM", "ALL_HEDGED", {
      last_question: "다른 조건은 어때요?",
      turns,
    }),
    {
      requiredScope: "DETAIL",
      allowedMoves: ["CONNECT", "CRITERION"],
      reason: "MEDIUM_HEDGED",
    },
  );
  assert.equal(
    deriveReflectOutputPolicy("DEFAULT", null, {
      last_question: "여기까지 남기고 마칠까요?",
      turns: [{ role: "user", text: "아니, 더 생각해볼래." }],
    }).reason,
    "DECLINED_CLOSURE",
  );
  assert.equal(
    deriveReflectOutputPolicy("DEFAULT", null, {
      last_question: "주말 일정이 부담스러운 건 어떤 순간이에요?",
      turns: [
        { role: "assistant", text: "비용이 걸리는 건 어떤 순간이에요?" },
        { role: "user", text: "새 화분을 살 때." },
        {
          role: "assistant",
          text: "주말 일정이 부담스러운 건 어떤 순간이에요?",
        },
        { role: "user", text: "토요일마다 행사가 잡힐 때." },
      ],
    }).reason,
    "REPEATED_FRAME",
  );
  assert.equal(
    deriveReflectOutputPolicy("DEFAULT", null, {
      last_question: "가장 아쉬운 점은 뭐예요?",
      turns: [{ role: "user", text: "책을 고를 수 없는 거." }],
    }).reason,
    "SHORT_ANSWER",
  );
});

test("LOW selects DEFAULT without inventing a MEDIUM reason", () => {
  const prepared = prepareReflection(lowJudge(), context());
  assert.ok(prepared.user.includes("REFLECT/LOW"));
  assert.ok(!prepared.user.includes("medium_reason:"));
  assert.equal(prepared.mode, "DEFAULT");
});

test("DEFAULT and MEDIUM require a bound user source", () => {
  for (const judge of [lowJudge(), mediumJudge()]) {
    const prepared = prepareReflection(judge, context());
    assert.equal(prepared.validateOutput(output()).source_turn, "U1");
    assert.throws(
      () =>
        prepared.validateOutput(
          output({ source_turn: null, source_quote: null }),
        ),
      /REFLECT_SOURCE_REQUIRED/,
    );
    assert.throws(
      () =>
        prepared.validateOutput(
          output({ source_turn: "U99", source_quote: "비슷하지" }),
        ),
      /REFLECT_SOURCE_UNAVAILABLE/,
    );
    assert.throws(
      () => prepared.validateOutput(output({ source_quote: "원문에 없는 말" })),
      /REFLECT_SOURCE_QUOTE_MISMATCH/,
    );
    assert.throws(() =>
      prepared.validateOutput(output({ source_quote: null })),
    );
  }
});

test("DEFAULT CONNECT is always normalized to the center it connects to", () => {
  const prepared = prepareReflection(lowJudge(), context());
  assert.deepEqual(
    prepared.validateOutput(output({ scope: "DETAIL", move: "CONNECT" })),
    output({ scope: "CENTER", move: "CONNECT" }),
  );
  const medium = prepareReflection(mediumJudge(), context());
  assert.equal(
    medium.validateOutput(output({ scope: "CENTER", move: "CONNECT" })).scope,
    "CENTER",
  );
});

test("a source may bind to explicit carryover but never to an assistant turn", () => {
  const prepared = prepareReflection(
    { ...mediumJudge(), evidence_turns: ["U0", "U1"] },
    {
      ...context(),
      turns: [
        { id: "A1", role: "assistant", text: "앞선 AI 표현" },
        ...context().turns,
      ],
      carryover: [{ turn: "U0", text: "앞선 사용자 표현" }],
    },
  );
  assert.equal(
    prepared.validateOutput(
      output({ source_turn: "U0", source_quote: "사용자 표현" }),
    ).source_turn,
    "U0",
  );
  assert.throws(() =>
    prepared.validateOutput(
      output({ source_turn: "A1", source_quote: "앞선 AI 표현" }),
    ),
  );
  assert.ok(prepared.user.includes("앞선 사용자 표현"));
  assert.ok(prepared.user.includes("U0, U1"));
});

test("recovery modes allow null provenance and enforce CENTER", () => {
  const recoveryContexts = [
    { ...context(), corrected_previous_frame: true },
    { ...context(), confused: true },
    { ...context(), non_answer: true },
    { ...context(), stalled: true },
    { ...context(), detail_streak: 2 },
  ];

  for (const rawContext of recoveryContexts) {
    const prepared = prepareReflection(mediumJudge(), rawContext);
    assert.equal(prepared.mustReturnToCenter, true);
    assert.equal(
      prepared.validateOutput(
        output({
          move: "RECOVERY",
          source_turn: null,
          source_quote: null,
        }),
      ).scope,
      "CENTER",
    );
    assert.throws(
      () =>
        prepared.validateOutput(
          output({
            scope: "DETAIL",
            move: "RECOVERY",
            source_turn: null,
            source_quote: null,
          }),
        ),
      (error: unknown) => error instanceof ReflectionCenterRequiredError,
    );
    assert.throws(
      () =>
        prepared.validateOutput(
          output({
            move: "CONNECT",
            source_turn: null,
            source_quote: null,
          }),
        ),
      /REFLECT_RECOVERY_MOVE_REQUIRED/,
    );
  }
});

test("PAST is blocked by used quota or an immediately preceding PAST", () => {
  for (const rawContext of [
    { ...context(), past_probe_count: 1 },
    { ...context(), last_question_type: "PAST" },
  ]) {
    const prepared = prepareReflection(mediumJudge(), rawContext);
    assert.ok(prepared.user.includes("past_allowed: false"));
    assert.throws(
      () => prepared.validateOutput(output({ type: "PAST" })),
      /PAST_NOT_ALLOWED/,
    );
    assert.equal(
      prepared.validateOutput(output({ type: "COMPARE" })).type,
      "COMPARE",
    );
  }
  assert.equal(
    prepareReflection(mediumJudge(), context()).validateOutput(
      output({ type: "PAST" }),
    ).type,
    "PAST",
  );
});

test("malformed output and unbounded moves cannot enter reflection", () => {
  assert.throws(() =>
    prepareReflection(mediumJudge(), { ...context(), main_question: "" }),
  );
  const prepared = prepareReflection(mediumJudge(), context());
  for (const invalid of [
    output({ question: "" }),
    output({ type: "OTHER" }),
    output({ scope: "OTHER" }),
    output({ move: "WHY" }),
    { ...output(), move: undefined },
    { ...output(), source_turn: undefined },
    { ...output(), lead_in: "그렇군요" },
  ])
    assert.throws(() => prepared.validateOutput(invalid));
});

test("missing, assistant or overlapping Judge evidence is rejected", () => {
  assert.throws(
    () =>
      prepareReflection(
        { ...mediumJudge(), evidence_turns: ["U99"] },
        context(),
      ),
    /EVIDENCE_UNAVAILABLE/,
  );
  assert.throws(() =>
    prepareReflection({ ...mediumJudge(), evidence_turns: ["A1"] }, context()),
  );
  assert.throws(
    () =>
      prepareReflection(mediumJudge(), {
        ...context(),
        carryover: [{ turn: "U1", text: "duplicate" }],
      }),
    /DUPLICATE_TURN_ID/,
  );
});

test("the detail streak is counted by code and forces a center return", () => {
  for (const streak of [0, 1]) {
    const prepared = prepareReflection(mediumJudge(), {
      ...context(),
      detail_streak: streak,
    });
    assert.equal(prepared.mode, "MEDIUM");
    assert.ok(prepared.user.includes(`detail_streak: ${streak}`));
    assert.ok(prepared.user.includes("must_return_to_center: false"));
    assert.ok(
      !prepared.user.includes("중심 질문의 말로 묻고 scope를 CENTER로"),
    );
  }

  const prepared = prepareReflection(mediumJudge(), {
    ...context(),
    detail_streak: 2,
  });
  assert.equal(prepared.mode, "RETURN_CENTER");
  assert.ok(prepared.user.includes("must_return_to_center: true"));
  assert.ok(
    prepared.user.includes("중심 질문의 말로 묻고 scope를 CENTER로 적는다."),
  );
});

test("the prepared contract exposes the exact previous question", () => {
  const prepared = prepareReflection(lowJudge(), {
    ...context(),
    last_question: "회사를 떠나고 싶은 건 언제예요?",
  });
  assert.equal(prepared.lastQuestion, "회사를 떠나고 싶은 건 언제예요?");
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
  assert.deepEqual(
    inspectReflectionQuestion(
      "비 오는 날 대안의 번거로움과 보관소는 어떻게 저울질돼요?",
    ),
    ["ANALYTIC_PHRASING"],
  );
});
