import assert from "node:assert/strict";
import test from "node:test";
import { executeReflection } from "../src/engine/reflect-runtime.ts";
import {
  inspectReflectionQuestion,
  REFLECT_QUESTION_LONG,
} from "../src/engine/reflect.ts";

const options = { model: "gpt-5.6-sol", reasoningEffort: "high" };

const judge = () => ({
  action: "REFLECT",
  shift_confidence: "LOW",
  medium_reason: null,
  evidence_turns: [],
  clarifications: [],
  branches: [],
  invalidate_clarifications: [],
  promote_pile_item: null,
});

const context = () => ({
  main_question: "이직할까?",
  past_probe_count: 0,
  last_question_type: null,
  last_question: "어느 때 이직 생각이 가장 커져요?",
  current_clarifications: [],
  turns: [
    {
      id: "U1",
      role: "user",
      text: "어느 회사나 비슷하지 않나 싶기도 해",
    },
  ],
  carryover: [],
});

const modelOutput = (overrides: Record<string, unknown> = {}) => ({
  scope: "CENTER",
  move: "CONNECT",
  question: "지금 가장 걸리는 건 뭐예요?",
  type: "PRESENT",
  source_turn: "U1",
  source_quote: "어느 회사나 비슷하지 않나 싶기도 해",
  ...overrides,
});

const fallback = {
  scope: "CENTER",
  question: "지금 질문에서 아직 남은 건 뭐예요?",
  type: "PRESENT",
  move: "RECOVERY",
  source_turn: null,
  source_quote: null,
};

function response(value: unknown) {
  return { status: "completed", output_text: JSON.stringify(value) };
}

async function captureWarnings<T>(run: () => Promise<T>) {
  const original = console.warn;
  const warnings: string[] = [];
  console.warn = (message?: unknown) => warnings.push(String(message));
  try {
    return { value: await run(), warnings };
  } finally {
    console.warn = original;
  }
}

test("valid Reflection output passes through one model call", async () => {
  let calls = 0;
  const expected = modelOutput();
  const result = await executeReflection(
    judge(),
    context(),
    options,
    async () => {
      calls++;
      return response(expected);
    },
  );

  assert.deepEqual(result, expected);
  assert.equal(calls, 1);
});

test("every question hard-gate failure returns the same zero-retry fallback", async () => {
  const cases = [
    [
      "missing question mark",
      "지금 가장 걸리는 건 뭐예요",
      "QUESTION_MARK_COUNT",
    ],
    [
      "question mark not at end",
      "지금 가장 걸리는 건 뭐예요? 말해 주세요",
      "QUESTION_MARK_END",
    ],
    ["multiple question marks", "언제예요? 왜예요?", "QUESTION_MARK_COUNT"],
    ["newline", "지금 가장 걸리는 건 뭐예요?\n", "QUESTION_NEWLINE"],
    ["over 40 nonspace characters", `${"가".repeat(40)}?`, "QUESTION_TOO_LONG"],
    ["diagnostic flag", "어떻게 될 것 같아요?", "QUESTION_DIAGNOSTIC"],
    [
      "analytic diagnostic flag",
      "이 선택은 어떤 의미예요?",
      "QUESTION_DIAGNOSTIC",
    ],
  ] as const;

  for (const [name, question, reason] of cases) {
    let calls = 0;
    const { value, warnings } = await captureWarnings(() =>
      executeReflection(judge(), context(), options, async () => {
        calls++;
        return response(modelOutput({ question }));
      }),
    );

    assert.deepEqual(value, fallback, name);
    assert.equal(calls, 1, name);
    assert.equal(warnings.length, 1, name);
    const diagnostic = JSON.parse(warnings[0]);
    assert.deepEqual(
      diagnostic,
      { evt: "nook_reflect_fallback", reason, mode: "DEFAULT" },
      name,
    );
    assert.doesNotMatch(warnings[0], /어느 회사|걸리는/, name);
  }
});

test("the 40-nonspace boundary is accepted", async () => {
  const output = modelOutput({ question: `${"가 ".repeat(39)}?` });
  const result = await executeReflection(
    judge(),
    context(),
    options,
    async () => response(output),
  );
  assert.deepEqual(result, output);
});

test("normalized repeat and forced DETAIL both recover without retry", async () => {
  const repeated = {
    ...context(),
    last_question: "지금 가장 걸리는 건 뭐예요?",
  };
  const forcedCenter = { ...context(), detail_streak: 2 };

  for (const [name, input, output, reason] of [
    [
      "repeat",
      repeated,
      modelOutput({ question: "지금　가장 걸리는 건 뭐예요？" }),
      "QUESTION_REPEATED",
    ],
    [
      "forced center",
      forcedCenter,
      modelOutput({ scope: "DETAIL" }),
      "CENTER_REQUIRED",
    ],
  ] as const) {
    let calls = 0;
    const { value, warnings } = await captureWarnings(() =>
      executeReflection(judge(), input, options, async () => {
        calls++;
        return response(output);
      }),
    );
    assert.deepEqual(value, fallback, name);
    assert.equal(calls, 1, name);
    assert.equal(JSON.parse(warnings[0]).reason, reason, name);
  }
});

test("fallback deterministically avoids repeating the normalized last question", async () => {
  const input = {
    ...context(),
    last_question: "지금　질문에서 아직 남은 건 뭐예요？",
  };
  let calls = 0;
  const { value, warnings } = await captureWarnings(() =>
    executeReflection(judge(), input, options, async () => {
      calls++;
      return response({ scope: "CENTER" });
    }),
  );

  assert.deepEqual(value, {
    ...fallback,
    question: "지금 가장 먼저 짚고 싶은 건 뭐예요?",
  });
  assert.equal(calls, 1);
  assert.equal(warnings.length, 1);
  assert.equal(inspectReflectionQuestion(value.question).length, 0);
  assert.equal((value.question.match(/[?？]/gu) ?? []).length, 1);
  assert.match(value.question, /[?？]$/u);
  assert.ok(value.question.replace(/\s/gu, "").length <= REFLECT_QUESTION_LONG);
});

test("valid JSON validation failures recover, including schema and PAST gates", async () => {
  const pastBlocked = { ...context(), past_probe_count: 1 };
  for (const [name, input, output] of [
    ["schema", context(), { scope: "CENTER" }],
    ["past", pastBlocked, modelOutput({ type: "PAST" })],
    [
      "source binding",
      context(),
      modelOutput({ source_quote: "모델이 만든 출처" }),
    ],
  ] as const) {
    let calls = 0;
    const { value, warnings } = await captureWarnings(() =>
      executeReflection(judge(), input, options, async () => {
        calls++;
        return response(output);
      }),
    );
    assert.deepEqual(value, fallback, name);
    assert.equal(calls, 1, name);
    assert.equal(JSON.parse(warnings[0]).reason, "OUTPUT_VALIDATION", name);
  }
});

test("provider, incomplete, and malformed JSON failures still surface", async () => {
  let calls = 0;
  await assert.rejects(
    executeReflection(judge(), context(), options, async () => {
      calls++;
      throw new Error("private provider detail");
    }),
    /^Error: REFLECT_PROVIDER_FAILED$/,
  );
  await assert.rejects(
    executeReflection(judge(), context(), options, async () => {
      calls++;
      return { status: "incomplete", output_text: "{}" };
    }),
    /^Error: REFLECT_RESPONSE_INCOMPLETE$/,
  );
  await assert.rejects(
    executeReflection(judge(), context(), options, async () => {
      calls++;
      return { status: "completed", output_text: "{" };
    }),
    /^Error: REFLECT_OUTPUT_INVALID$/,
  );
  assert.equal(calls, 3);
});
