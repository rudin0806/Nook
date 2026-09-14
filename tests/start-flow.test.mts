import assert from "node:assert/strict";
import test from "node:test";
import { createStartFlow } from "../src/engine/start-flow.ts";
import { executeSafety, mapSafety } from "../src/engine/safety.ts";
import {
  executeStartClassification,
  executeNodeZero,
} from "../src/engine/start.ts";
import type { JsonTransport } from "../src/engine/json-model.ts";
const options = { model: "gpt-5.6-sol", reasoningEffort: "high" };
const thought = "이직도 고민이고 친구한테 서운한 것도 있어";
const a = {
  label: "REFRAME_NEEDED",
  focus_required: true,
  focus_question: "이직과 친구한테 서운한 것 중 무엇부터 이야기할까요?",
  focus_candidates: ["이직", "친구한테 서운한 것"],
  info_guidance: null,
};
const proposal = {
  question: "이직에 대해 무엇을 고민하고 있을까?",
  evidence_sentence: "이직이 고민이라고 했어요.",
  evidence_quotes: ["이직도 고민"],
};
const reply =
  (value: unknown): JsonTransport =>
  async (request) => {
    assert.equal(request.store, false);
    return { status: "completed", output_text: JSON.stringify(value) };
  };
const allowed = { label: "NONE", category: "NONE" };

test("strict safety output and deterministic behavior reject old labels and extra fields", async () => {
  assert.equal(mapSafety(allowed).behavior, "CONTINUE");
  assert.equal(
    mapSafety({ label: "NONE", category: "SUICIDE_SELF_HARM" }).behavior,
    "HANDOFF",
  );
  assert.equal(
    mapSafety({ label: "HIGH_RISK", category: "YOUTH" }).behavior,
    "STOP",
  );
  for (const invalid of [
    { ...allowed, category: null },
    { ...allowed, behavior: "STOP" },
    { label: "HIGH_RISK", category: "NONE" },
  ])
    assert.throws(() => mapSafety(invalid));
  const result = await executeSafety(
    { context: [], utterance: thought },
    options,
    reply(allowed),
  );
  assert.equal(result.behavior, "CONTINUE");
});

test("start field combinations and invented focus candidates fail validation", async () => {
  for (const bad of [
    { ...a, label: "NEEDS_INFO" },
    { ...a, focus_candidates: ["이직", "번아웃"] },
    { ...a, focus_required: false },
    { ...a, focus_candidates: ["이직", "이직"] },
    { ...a, lead_in: "new" },
  ]) {
    await assert.rejects(
      executeStartClassification({ raw_thought: thought }, options, reply(bad)),
      /OUTPUT_INVALID/,
    );
  }
  assert.deepEqual(
    await executeStartClassification(
      { raw_thought: thought },
      options,
      reply(a),
    ),
    a,
  );
});

test("Node 0 only accepts source quotes, one question, and allowed generation models", async () => {
  const input = {
    raw_thought: thought,
    selected_focus: null,
    focus_reply: null,
  };
  for (const bad of [
    { ...proposal, evidence_quotes: ["숨은 불안"] },
    { ...proposal, question: "이직? 연애?" },
    { ...proposal, evidence_quotes: ["이직", "이직"] },
    { ...proposal, lead_in: "x" },
  ])
    await assert.rejects(
      executeNodeZero(input, options, reply(bad)),
      /OUTPUT_INVALID/,
    );
  for (const model of ["gpt-6-astra", "gpt-5.6-luna"])
    await assert.rejects(
      executeNodeZero(input, { ...options, model }, reply(proposal)),
      /MODEL_NOT_ALLOWED/,
    );
  assert.deepEqual(
    await executeNodeZero(input, options, reply(proposal)),
    proposal,
  );
});

test("STOP and HANDOFF prevent both start and generation and return no source text", async () => {
  for (const label of ["NONE", "HIGH_RISK"] as const) {
    let calls = 0;
    const flow = createStartFlow(thought, {
      safetyGate: async () => ({ label, category: "SUICIDE_SELF_HARM" }),
      classify: async () => {
        calls++;
        return a;
      },
      generate: async () => {
        calls++;
        return proposal;
      },
    });
    const result = await flow.start();
    assert.equal(result.kind, label === "NONE" ? "HANDOFF" : "STOP");
    assert.equal(calls, 0);
    assert.ok(!JSON.stringify(result).includes(thought));
  }
});

test("concurrent duplicate calls run once per draft; selection required and conflicting selection refused", async () => {
  const calls: string[] = [];
  const flow = createStartFlow(thought, {
    safetyGate: async () => {
      calls.push("safety");
      return allowed;
    },
    classify: async () => {
      calls.push("start");
      return a;
    },
    generate: async (input) => {
      calls.push("node");
      assert.equal(input.selected_focus, "이직");
      return proposal;
    },
  });
  await assert.rejects(flow.selectFocus(0), /FOCUS_INVALID/);
  const [first, second] = await Promise.all([flow.start(), flow.start()]);
  assert.equal(first.kind, "FOCUS_REQUIRED");
  if (first.kind === "FOCUS_REQUIRED") first.candidates[0] = "forged";
  assert.notDeepEqual(first, second);
  assert.deepEqual(calls, ["safety", "start"]);
  const results = await Promise.all([flow.selectFocus(0), flow.selectFocus(0)]);
  assert.deepEqual(results[0], { kind: "PROPOSAL", proposal });
  assert.deepEqual(calls, ["safety", "start", "safety", "node"]);
  await assert.rejects(flow.selectFocus(1), /ALREADY_SELECTED/);
});

test("focus selection is gated again; invalid or unavailable gate never proceeds", async () => {
  let checks = 0;
  const flow = createStartFlow(thought, {
    safetyGate: async () =>
      ++checks === 1
        ? allowed
        : { label: "HIGH_RISK", category: "SUICIDE_SELF_HARM" },
    classify: async () => a,
    generate: async () => {
      throw new Error("must not run");
    },
  });
  await flow.start();
  assert.equal((await flow.selectFocus(0)).kind, "STOP");
  for (const fail of [
    async () => ({ ...allowed, category: null }),
    async () => {
      throw new Error("PRIVATE_TEXT");
    },
  ]) {
    const blocked = createStartFlow(thought, {
      safetyGate: fail,
      classify: async () => {
        assert.fail();
      },
      generate: async () => {
        assert.fail();
      },
    });
    await assert.rejects(blocked.start(), /^Error: START_FLOW_FAILED$/);
  }
});

test("NEEDS_INFO and CLEAR_AS_IS do not call generation; single focus does", async () => {
  for (const label of ["NEEDS_INFO", "CLEAR_AS_IS", "REFRAME_NEEDED"]) {
    let calls = 0;
    const flow = createStartFlow(thought, {
      safetyGate: async () => allowed,
      classify: async () => ({
        label,
        focus_required: false,
        focus_question: null,
        focus_candidates: [],
        info_guidance:
          label === "NEEDS_INFO" ? "비교 항목을 확인해보세요." : null,
      }),
      generate: async () => {
        calls++;
        return proposal;
      },
    });
    const result = await flow.start();
    assert.equal(calls, label === "REFRAME_NEEDED" ? 1 : 0);
    if (result.kind === "CLEAR_AS_IS") assert.equal(result.question, thought);
  }
});

test("provider failures are scrubbed, no retries, input/output bounds enforced before release", async () => {
  let calls = 0;
  const fail: JsonTransport = async () => {
    calls++;
    throw new Error("PRIVATE_TEXT");
  };
  await assert.rejects(
    executeSafety({ context: [], utterance: thought }, options, fail),
    /^Error: SAFETY_PROVIDER_FAILED$/,
  );
  assert.equal(calls, 1);
  await assert.rejects(
    executeSafety({ context: [], utterance: "x".repeat(5001) }, options, fail),
    /INPUT_INVALID/,
  );
  assert.equal(calls, 1);
  await assert.rejects(
    executeStartClassification({ raw_thought: thought }, options, async () => ({
      status: "incomplete",
      output_text: JSON.stringify(a),
    })),
    /INCOMPLETE/,
  );
  await assert.rejects(
    executeStartClassification({ raw_thought: thought }, options, async () => ({
      status: "completed",
      output_text: "not json",
    })),
    /OUTPUT_INVALID/,
  );
  let attempts = 0;
  const flow = createStartFlow(thought, {
    safetyGate: async () => allowed,
    classify: async () => {
      attempts++;
      throw new Error("private");
    },
    generate: async () => proposal,
  });
  await assert.rejects(flow.start(), /START_FLOW_FAILED/);
  await assert.rejects(flow.start(), /START_FLOW_FAILED/);
  assert.equal(attempts, 1);
});
