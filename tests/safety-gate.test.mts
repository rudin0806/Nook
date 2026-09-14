import test from "node:test";
import assert from "node:assert/strict";
import { executeSafetyGate } from "../src/engine/safety-gate.ts";
import { MODERATION_CATEGORIES } from "../src/engine/moderation.ts";
import { createStartFlow } from "../src/engine/start-flow.ts";
const options = { model: "gpt-5.6-sol", reasoningEffort: "high" };
const input = { context: ["이직을 고민해"], utterance: "친구 걱정도 있어" };
const moderation = (flagged = false) => ({
  id: "provider-metadata-not-forwarded",
  results: [
    {
      flagged,
      categories: Object.fromEntries(
        MODERATION_CATEGORIES.map((k) => [k, k === "self-harm" && flagged]),
      ),
      category_scores: { "self-harm": 0.99 },
    },
  ],
});
const output = (label = "NONE", category = "NONE") => ({
  status: "completed",
  output_text: JSON.stringify({ label, category }),
});

test("moderation precedes classification; only bounded flags accompany original context", async () => {
  const calls: string[] = [];
  const result = await executeSafetyGate(input, options, {
    moderate: async (request) => {
      calls.push("moderation");
      assert.deepEqual(request, {
        model: "omni-moderation-latest",
        input: input.utterance,
      });
      return moderation(true);
    },
    classify: async (request) => {
      calls.push("classifier");
      assert.equal(request.store, false);
      const sent = JSON.stringify(request.input);
      assert.ok(!sent.includes("category_scores"));
      assert.ok(!sent.includes("provider-metadata"));
      assert.ok(sent.includes("self-harm"));
      assert.ok(sent.includes(input.context[0]));
      // A flag is not itself a STOP decision: contextual classification decides.
      return output();
    },
  });
  assert.deepEqual(calls, ["moderation", "classifier"]);
  assert.equal(result.behavior, "CONTINUE");
  assert.ok(!JSON.stringify(result).includes(input.utterance));
});

test("negative moderation still reaches classifier; HANDOFF and STOP use fixed mapping", async () => {
  for (const [label, behavior] of [
    ["NONE", "HANDOFF"],
    ["HIGH_RISK", "STOP"],
  ]) {
    const result = await executeSafetyGate(input, options, {
      moderate: async () => moderation(),
      classify: async () => output(label, "SUICIDE_SELF_HARM"),
    });
    assert.equal(result.behavior, behavior);
    assert.deepEqual(result.contact, { primary: "109", urgent: "119" });
  }
});

test("provider failure is scrubbed; missing, extra or malformed result batches never call classifier", async () => {
  for (const response of [
    null,
    {},
    { results: [] },
    { results: [moderation().results[0], moderation().results[0]] },
    { results: [{ flagged: false, categories: {} }] },
  ]) {
    await assert.rejects(
      executeSafetyGate(input, options, {
        moderate: async () => response,
        classify: async () => assert.fail("classifier must not run"),
      }),
      /^Error: MODERATION_OUTPUT_INVALID$/,
    );
  }
  let attempts = 0;
  await assert.rejects(
    executeSafetyGate(input, options, {
      moderate: async () => {
        attempts++;
        throw new Error("private source and credentials");
      },
      classify: async () => assert.fail(),
    }),
    /^Error: MODERATION_PROVIDER_FAILED$/,
  );
  assert.equal(attempts, 1);
});

test("caller cannot inject moderation or oversize text; no provider call before validation", async () => {
  for (const raw of [
    { ...input, moderation: { flagged: false } },
    { ...input, utterance: "x".repeat(5001) },
  ]) {
    await assert.rejects(
      executeSafetyGate(raw, options, {
        moderate: async () => assert.fail(),
        classify: async () => assert.fail(),
      }),
      /INPUT_INVALID/,
    );
  }
});

test("invalid classifier result, incomplete response and provider failure stop the gate", async () => {
  for (const reply of [
    output("HIGH_RISK", "NONE"),
    { status: "incomplete", output_text: "{}" },
    { status: "completed", output_text: "private malformed text" },
  ]) {
    await assert.rejects(
      executeSafetyGate(input, options, {
        moderate: async () => moderation(),
        classify: async () => reply,
      }),
      /SAFETY_(OUTPUT_INVALID|RESPONSE_INCOMPLETE)/,
    );
  }
  await assert.rejects(
    executeSafetyGate(input, options, {
      moderate: async () => moderation(),
      classify: async () => {
        throw new Error("private");
      },
    }),
    /^Error: SAFETY_PROVIDER_FAILED$/,
  );
});

test("complete gate stops start generation and repeated start does not repeat failed calls", async () => {
  for (const label of ["NONE", "HIGH_RISK"]) {
    const flow = createStartFlow(input.utterance, {
      safetyGate: async (raw) => {
        const result = await executeSafetyGate(raw, options, {
          moderate: async () => moderation(),
          classify: async () => output(label, "SUICIDE_SELF_HARM"),
        });
        return { label: result.label, category: result.category };
      },
      classify: async () => assert.fail(),
      generate: async () => assert.fail(),
    });
    assert.equal(
      (await flow.start()).kind,
      label === "NONE" ? "HANDOFF" : "STOP",
    );
  }
  let calls = 0;
  const flow = createStartFlow(input.utterance, {
    safetyGate: (raw) =>
      executeSafetyGate(raw, options, {
        moderate: async () => {
          calls++;
          throw new Error("private");
        },
        classify: async () => assert.fail(),
      }),
    classify: async () => assert.fail(),
    generate: async () => assert.fail(),
  });
  await assert.rejects(flow.start(), /^Error: START_FLOW_FAILED$/);
  await assert.rejects(flow.start(), /^Error: START_FLOW_FAILED$/);
  assert.equal(calls, 1);
});

test("invalid model configuration performs no moderation or classification", async () => {
  await assert.rejects(
    executeSafetyGate(
      input,
      { ...options, model: "gpt-6-astra" },
      {
        moderate: async () => assert.fail(),
        classify: async () => assert.fail(),
      },
    ),
    /MODEL_NOT_ALLOWED/,
  );
});
