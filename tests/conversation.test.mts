import assert from "node:assert/strict";
import test from "node:test";
import {
  planConversationTurn,
  explicitFinish,
} from "../src/engine/conversation.ts";
import {
  runConversationRequest,
  type ConversationDependencies,
} from "../src/engine/conversation-request.ts";
import { executeReflection } from "../src/engine/reflect-runtime.ts";
import { conversationSnapshotSchema } from "../src/schemas/conversation.ts";
import {
  makeConversationRequest,
  sendConversation,
} from "../src/lib/conversation/client.ts";
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const config = {
  model: "gpt-5.6-sol",
  reasoningEffort: "high",
  maxOutputTokens: 2048,
};
const low = {
  action: "REFLECT",
  shift_confidence: "LOW",
  medium_reason: null,
  evidence_turns: [],
  clarifications: [],
  branches: [],
  invalidate_clarifications: [],
  promote_pile_item: null,
};
const reflectionOutput = (
  question: string,
  overrides: Record<string, unknown> = {},
) => ({
  scope: "CENTER",
  move: "CONNECT",
  question,
  type: "PRESENT",
  source_turn: "U1",
  source_quote: "새 회사에서도 같은 일을 할까 봐 고민이야",
  ...overrides,
});
const startNode = {
  id: id(3),
  segment_id: id(2),
  ordinal: 1,
  ai_proposed_text: "이직할까?",
  final_text: "이직할까?",
  approved_at: "2026-09-16T00:00:00Z",
};
function snapshot() {
  return conversationSnapshotSchema.parse({
    session: {
      id: id(1),
      status: "ACTIVE",
      storage_state: "TEMPORARY",
      past_probe_count: 0,
    },
    segment: {
      id: id(2),
      ordinal: 1,
      node_count: 1,
      turn_count: 2,
      branch_count: 0,
      anchor_node_id: null,
    },
    current: startNode,
    path: [startNode],
    messages: [
      {
        id: id(4),
        role: "USER",
        content: "새 회사에서도 같은 일을 할까 봐 고민이야",
        kind: "USER_REPLY",
        sequence_no: 1,
        segment_id: id(2),
        created_at: "2026-09-16T00:00:00Z",
      },
    ],
    clarifications: [],
    pile: [],
    state: {
      version: 0,
      mode: "READY",
      pending: null,
      last_question_type: null,
      detail_streak: 0,
      carryover: [],
    },
  });
}
const options = { judge: config, reframe: config, reflect: config };
test("REFLECT routes through Judge then D and preserves no-store bounded requests", async () => {
  const replies = [
    low,
    reflectionOutput("같은 일을 반복하면 가장 아쉬운 건 뭐예요?"),
  ];
  let calls = 0;
  const plan = await planConversationTurn(
    snapshot(),
    options,
    async (request) => {
      assert.equal(request.store, false);
      assert.equal(request.max_output_tokens, 2048);
      return {
        status: "completed",
        output_text: JSON.stringify(replies[calls++]),
      };
    },
  );
  assert.equal(calls, 2);
  assert.equal(plan.kind, "REFLECT");
  // scope는 커밋 payload로 그대로 넘어가야 한다. DB가 이 라벨로 연속 횟수를 센다.
  assert.equal(plan.scope, "CENTER");
  assert.equal(plan.turnIds.U1, id(4));
});
test("SHIFT produces only a proposal with trusted evidence references", async () => {
  const replies = [
    {
      ...low,
      action: "SHIFT",
      shift_confidence: "HIGH",
      evidence_turns: ["U1"],
    },
    {
      question: "어떤 일을 하고 싶은 걸까?",
      evidence_sentence: "같은 일을 하게 될지를 고민하고 있어요.",
    },
  ];
  let calls = 0;
  const plan = await planConversationTurn(snapshot(), options, async () => ({
    status: "completed",
    output_text: JSON.stringify(replies[calls++]),
  }));
  assert.equal(plan.kind, "SHIFT");
  assert.deepEqual(plan.evidence_ids, [id(4)]);
  assert.equal(plan.one_turn_shift, true);
  assert.equal(calls, 2);
});
test("explicit control and structural limits bypass all core model calls", async () => {
  const s = snapshot();
  s.segment.turn_count = 20;
  const transport = async () => {
    throw Error("MODEL_MUST_NOT_RUN");
  };
  assert.equal(
    (await planConversationTurn(s, options, transport)).kind,
    "STRUCTURAL",
  );
  s.messages[0].content = "그만할래";
  assert.equal(
    (await planConversationTurn(s, options, transport)).kind,
    "FINISH",
  );
  assert.equal(explicitFinish("일을 그만할래"), false);
  assert.equal(explicitFinish("그만할래? 라고 물었어"), false);
});
test("CLOSE never calls a generator and has no fabricated confidence", async () => {
  const close = { ...low, action: "CLOSE" } as Partial<typeof low>;
  delete close.shift_confidence;
  let calls = 0;
  const plan = await planConversationTurn(snapshot(), options, async () => {
    calls++;
    return { status: "completed", output_text: JSON.stringify(close) };
  });
  assert.equal(plan.kind, "CLOSE");
  assert.equal(calls, 1);
  assert.equal(Object.hasOwn(plan.judge!, "shift_confidence"), false);
});
test("Reflection recovers from a second past probe and multi-question output", async () => {
  const context = {
    main_question: "이직할까?",
    past_probe_count: 1,
    last_question_type: null,
    current_clarifications: [],
    turns: [{ id: "U1", role: "user", text: "고민이야" }],
    carryover: [],
  };
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    for (const output of [
      {
        scope: "CENTER",
        move: "CONNECT",
        question: "예전에는 어땠나요?",
        type: "PAST",
        source_turn: "U1",
        source_quote: "고민이야",
      },
      {
        scope: "CENTER",
        move: "CONNECT",
        question: "언제인가요? 왜인가요?",
        type: "PRESENT",
        source_turn: "U1",
        source_quote: "고민이야",
      },
    ]) {
      const result = await executeReflection(
        low,
        context,
        config,
        async () => ({
          status: "completed",
          output_text: JSON.stringify(output),
        }),
      );
      assert.equal(result.move, "RECOVERY");
      assert.equal(result.scope, "CENTER");
      assert.equal(result.question, "지금 질문에서 아직 남은 건 뭐예요?");
    }
  } finally {
    console.warn = originalWarn;
  }
});
function dependencies(behavior: "CONTINUE" | "STOP" | "HANDOFF" = "CONTINUE") {
  const events: string[] = [];
  const s = snapshot();
  let savedText: string | null | undefined;
  const d: ConversationDependencies = {
    store: {
      claim: async () => ({ status: "CLAIMED", token: id(6) }),
      finish: async () => {
        events.push("failed");
        return true;
      },
    },
    load: async () => {
      events.push("load");
      return s;
    },
    replay: async () => ({ version: 3, mode: "READY" }),
    safety: async () => {
      events.push("safety");
      return {
        behavior,
        label: behavior === "STOP" ? "HIGH_RISK" : "NONE",
        category: behavior === "CONTINUE" ? "NONE" : "SUICIDE_SELF_HARM",
        contact: null,
      };
    },
    commit: async (phase, text) => {
      events.push(phase);
      savedText = text;
      s.state.version++;
      return {
        version: s.state.version,
        mode: phase === "safety" ? behavior : "READY",
      };
    },
    generate: async () => {
      events.push("judge");
      return {};
    },
    openTurn: async () => {
      events.push("open");
    },
  };
  return { d, events, getText: () => savedText };
}
const input = {
  requestId: id(5),
  nodeId: id(3),
  version: 0,
  action: "reply" as const,
  text: "내가 적은 답변",
};
test("Safety precedes durable input, which precedes Judge and final commit", async () => {
  const { d, events } = dependencies();
  await runConversationRequest(input, id(9), "x".repeat(32), d);
  assert.deepEqual(events, [
    "load",
    "safety",
    "input",
    "load",
    "judge",
    "output",
  ]);
});
test("opening turn generates without writing a new user message", async () => {
  const { d, events } = dependencies();
  await runConversationRequest(
    { requestId: id(5), nodeId: id(3), version: 0, action: "open" },
    id(9),
    "x".repeat(32),
    d,
  );
  // 발화를 받지 않으므로 Safety도 input도 없고, 두 번째 load도 없다.
  assert.deepEqual(events, ["load", "open", "judge", "output"]);
});
test("opening turn is refused once Nook has already spoken", async () => {
  const { d, events } = dependencies();
  const base = d.load;
  d.load = async () => {
    const s = await base();
    return {
      ...s,
      messages: [
        ...s.messages,
        {
          id: id(8),
          role: "ASSISTANT" as const,
          content: "무엇이 가장 걸려요?",
          kind: "REFLECTION" as const,
          sequence_no: 2,
          segment_id: id(2),
          created_at: "2026-09-16T00:01:00Z",
        },
      ],
    };
  };
  await assert.rejects(() =>
    runConversationRequest(
      { requestId: id(5), nodeId: id(3), version: 0, action: "open" },
      id(9),
      "x".repeat(32),
      d,
    ),
  );
  assert.deepEqual(events, ["load", "failed"]);
});
test("STOP never passes raw text to persistence or Judge; HANDOFF preserves the message", async () => {
  for (const behavior of ["STOP", "HANDOFF"] as const) {
    const { d, events, getText } = dependencies(behavior);
    await runConversationRequest(input, id(9), "x".repeat(32), d);
    assert.deepEqual(events, ["load", "safety", "safety"]);
    assert.equal(getText(), behavior === "STOP" ? null : input.text);
  }
});
test("completed replay does not call Safety, load, generation or commit", async () => {
  const { d, events } = dependencies();
  d.store.claim = async () => ({ status: "SUCCEEDED", result_id: id(1) });
  const r = await runConversationRequest(input, id(9), "x".repeat(32), d);
  assert.equal(r.status, "SUCCEEDED");
  assert.deepEqual(events, []);
});
test("generation failure cannot commit output and failed request is not retried automatically", async () => {
  const { d, events } = dependencies();
  d.generate = async () => {
    events.push("judge");
    throw Error("private provider response");
  };
  await assert.rejects(
    () => runConversationRequest(input, id(9), "x".repeat(32), d),
    /^Error: CONVERSATION_FAILED_OR_UNKNOWN$/,
  );
  assert.deepEqual(events, [
    "load",
    "safety",
    "input",
    "load",
    "judge",
    "failed",
  ]);
});
test("stale revision is rejected before paid calls", async () => {
  const { d, events } = dependencies();
  await assert.rejects(() =>
    runConversationRequest({ ...input, version: 2 }, id(9), "x".repeat(32), d),
  );
  assert.deepEqual(events, ["load", "failed"]);
});
test("client preserves request ID on retry and rejects malformed success", async () => {
  const body = makeConversationRequest(input, id(5));
  let calls = 0;
  const send: typeof fetch = async (_url, init) => {
    assert.equal(init!.body, body);
    calls++;
    return Response.json({ data: { status: "RUNNING" } }, { status: 202 });
  };
  await sendConversation(body, send);
  await sendConversation(body, send);
  assert.equal(calls, 2);
  await assert.rejects(() =>
    sendConversation(body, async () =>
      Response.json({
        data: { status: "SUCCEEDED", result: { mode: "READY" } },
      }),
    ),
  );
});

test("continuing preserves the declined closure context outside the current window", async () => {
  const s = snapshot();
  s.state.dismissed_closure = "회사가 아니라 반복 업무를 바꾸고 싶었던 거네";
  let calls = 0;
  const plan = await planConversationTurn(s, options, async (request) => {
    if (calls === 0)
      assert.ok(
        request.input[0].content[0].text.includes(s.state.dismissed_closure!),
      );
    return {
      status: "completed",
      output_text: JSON.stringify(
        calls++ === 0 ? low : reflectionOutput("업무에서 더 살펴볼 건 뭐예요?"),
      ),
    };
  });
  assert.equal(plan.kind, "REFLECT");
  assert.equal(calls, 2);
});

test("the stored detail streak reaches Prompt D", async () => {
  const base = snapshot();
  const raw = {
    ...base,
    state: { ...base.state, detail_streak: 2 },
  };
  let seen = "";
  let calls = 0;
  await planConversationTurn(raw, options, async (request) => {
    const text = (request.input[0].content[0] as { text: string }).text;
    if (calls++ === 1) seen = text;
    return {
      status: "completed",
      output_text: JSON.stringify(
        calls === 1 ? low : reflectionOutput("지금 가장 걸리는 게 뭐예요?"),
      ),
    };
  });
  assert.ok(seen.includes("must_return_to_center: true"));
});
