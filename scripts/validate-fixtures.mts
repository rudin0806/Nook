import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

// Static fixture validation only. This script never calls or scores a model.
const root = resolve(import.meta.dirname, "..");
const strings = z.array(z.string());
const confidence = z.enum(["HIGH", "MEDIUM", "LOW"]);
const turn = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  text: z.string().min(1),
});
const base = z.object({
  id: z.string(),
  mode: z.enum(["strict", "boundary", "pending"]),
  rationale: z.string(),
});
const extraction = z.object({
  expect: z.enum(["ANY", "EMPTY", "NON_EMPTY"]),
  reference: strings,
  forbidden_keywords: strings,
  forbidden_examples: strings,
});
const judgeSchema = base.extend({
  depends_on: strings,
  candidates: z.array(z.unknown()),
  ai_turns_d_compliant: z.boolean(),
  fixture_meta: z.object({
    history: z.array(turn),
    expected_hedge_speaker: z.boolean(),
  }),
  input: z
    .object({
      main_question: z.string(),
      main_path: strings,
      pile: z.array(z.object({ id: z.string(), text: z.string() })),
      current_clarifications: z.array(
        z.object({
          id: z.string(),
          text: z.string(),
          confidence,
          evidence_turns: strings,
        }),
      ),
      carryover: z
        .array(
          z.object({
            turn: z.string(),
            text: z.string(),
            judged: z.literal("MEDIUM"),
            medium_reason: z.string().optional(),
          }),
        )
        .max(2),
      turns: z.array(turn).min(1),
    })
    .passthrough(),
  expected: z.object({
    accept: strings.min(1),
    evidence_must_include: strings,
    evidence_allowed: strings,
    clarifications: extraction.extend({
      high_only_keywords: strings,
      high_only_examples: strings,
    }),
    branches: extraction,
    invalidate_clarifications: z.object({
      expect: z.enum(["EMPTY", "EXACT"]),
      ids: strings,
    }),
    promote_pile_item: z.object({
      expect: z.enum(["EMPTY", "EXACT"]),
      id: z.string().nullable(),
    }),
  }),
});
const safetySchema = base.extend({
  depends_on: strings,
  candidates: z.array(z.unknown()).optional(),
  input: z.object({ context: strings, utterance: z.string().min(1) }),
  expected: z.object({
    label: z.enum(["NONE", "AMBIGUOUS", "HIGH_RISK"]),
    category: z.string().nullable(),
    behavior: z.enum(["CONTINUE", "STOP", "HANDOFF"]),
    contact: z.string().nullable(),
  }),
});
const startSchema = base.extend({
  chip: z.boolean(),
  input: z.object({ raw_thought: z.string().min(1) }),
  expected: z.object({
    label: z.enum(["NEEDS_INFO", "CLEAR_AS_IS", "REFRAME_NEEDED"]),
    node0_reference: z.string().nullable(),
    forbidden_keywords: strings,
    output_check: z.string(),
  }),
});
type Issue = {
  kind: "fixture" | "compatibility";
  id: string;
  check: string;
  detail: string;
};
const issues: Issue[] = [];
function check(
  ok: boolean,
  id: string,
  name: string,
  detail: string,
  kind: Issue["kind"] = "fixture",
) {
  if (!ok) issues.push({ kind, id, check: name, detail });
}
function readRows<T>(
  file: string,
  schema: z.ZodType<T>,
  expectedCount: number,
): T[] {
  const lines = readFileSync(resolve(root, "eval", file), "utf8")
    .trimEnd()
    .split(/\r?\n/);
  check(
    lines.length === expectedCount,
    file,
    "count",
    `${lines.length}/${expectedCount}`,
  );
  return lines.flatMap((line, i) => {
    try {
      return [schema.parse(JSON.parse(line))];
    } catch (error) {
      issues.push({
        kind: "fixture",
        id: `${file}:${i + 1}`,
        check: "schema",
        detail: String(error),
      });
      return [];
    }
  });
}
const judge = readRows("judge.jsonl", judgeSchema, 32);
const safety = readRows("safety.jsonl", safetySchema, 15);
const start = readRows("start.jsonl", startSchema, 17);
const all = [...judge, ...safety, ...start];
check(
  new Set(all.map((r) => r.id)).size === all.length,
  "all",
  "unique_ids",
  "Duplicate case id",
);
check(
  all.every((r) => r.mode !== "pending"),
  "all",
  "pending",
  "Expected zero pending rows",
);
check(
  JSON.stringify(all.filter((r) => r.mode === "boundary").map((r) => r.id)) ===
    '["J-SHIFT-04"]',
  "all",
  "boundary",
  "Only J-SHIFT-04 is boundary",
);

// Two declared audit lists; neither is an implemented production hedge detector.
const endings = {
  minimal: /(것 같아|것 같기도 해|싶기도 해)$/u,
  broad:
    /(것 같아|것 같기도 해|것 같기도|것 같긴 해|싶기도 해|건가 싶어|나 봐|아마|글쎄|그런 듯)$/u,
};
const hedge: Record<
  string,
  Record<string, { total: number; hedged: number; flag: boolean }>
> = {};
for (const r of judge) {
  const turns = [...r.fixture_meta.history, ...r.input.turns];
  check(
    new Set(turns.map((t) => t.id)).size === turns.length,
    r.id,
    "turn_ids",
    "history and window must not double-count turns",
  );
  check(
    turns.every((t) =>
      new RegExp(t.role === "user" ? "^U[0-9]+$" : "^A[0-9]+$").test(t.id),
    ),
    r.id,
    "turn_roles",
    "Evidence IDs must distinguish user and assistant",
  );
  check(
    !("hedge_speaker" in r.input) && !("hedge_ratio" in r.input),
    r.id,
    "hedge_input",
    "Calculate the flag; do not hardcode it in input",
  );
  hedge[r.id] = {};
  for (const [name, pattern] of Object.entries(endings)) {
    const users = turns.filter((t) => t.role === "user");
    const hedged = users.filter((t) =>
      pattern.test(t.text.trim().replace(/[.!?…。！？\s]+$/gu, "")),
    ).length;
    const flag = users.length >= 5 && hedged / users.length >= 0.7;
    hedge[r.id][name] = { total: users.length, hedged, flag };
    check(
      flag === r.fixture_meta.expected_hedge_speaker,
      r.id,
      `hedge_${name}`,
      `${hedged}/${users.length}: ${flag}`,
    );
  }
  const userIds = new Set(
    r.input.turns.filter((t) => t.role === "user").map((t) => t.id),
  );
  for (const c of r.input.carryover) {
    userIds.add(c.turn);
    check(
      turns.some(
        (t) => t.role === "user" && t.id === c.turn && t.text === c.text,
      ),
      r.id,
      "carryover_source",
      c.turn,
    );
    check(
      !!c.medium_reason,
      r.id,
      "carryover_medium_reason",
      `${c.turn}: repository RULES requires medium_reason; uploaded v4 omits it`,
      "compatibility",
    );
  }
  check(
    r.expected.evidence_allowed.every((id) => userIds.has(id)),
    r.id,
    "evidence_allowed",
    "Only current window or explicit carryover user evidence is allowed",
  );
  check(
    r.expected.evidence_must_include.every((id) =>
      r.expected.evidence_allowed.includes(id),
    ),
    r.id,
    "evidence_required",
    "Required evidence must be allowed",
  );
  for (const c of r.input.current_clarifications)
    check(
      c.evidence_turns.every((id) =>
        turns.some((t) => t.id === id && t.role === "user"),
      ),
      r.id,
      "clarification_evidence",
      c.id,
    );
  for (const [name, items] of [
    ["pile", r.input.pile],
    ["clarifications", r.input.current_clarifications],
  ] as const)
    check(
      new Set(items.map((i) => i.id)).size === items.length,
      r.id,
      `${name}_ids`,
      "Duplicate input id",
    );
  check(
    r.expected.accept.every((a) =>
      /^(SHIFT\/HIGH|REFLECT\/(MEDIUM|LOW)|CLOSE\/\*)$/.test(a),
    ),
    r.id,
    "accept",
    r.expected.accept.join(", "),
  );
  check(
    r.mode !== "boundary" || r.expected.accept.length > 1,
    r.id,
    "boundary_accept",
    "Need multiple accepted outcomes",
  );
  const c = r.expected.clarifications;
  const overlap = c.high_only_keywords.filter((k) =>
    c.forbidden_keywords.some((f) => k.includes(f) || f.includes(k)),
  );
  check(overlap.length === 0, r.id, "keyword_layers", overlap.join(", "));
  check(
    c.high_only_examples.every((e) => !c.forbidden_examples.includes(e)),
    r.id,
    "example_layers",
    "HIGH-only example also forbidden at all confidence levels",
  );
  for (const [name, e] of [
    ["clarifications", c],
    ["branches", r.expected.branches],
  ] as const) {
    check(
      e.expect !== "EMPTY" || e.reference.length === 0,
      r.id,
      `${name}_empty`,
      "EMPTY contradicts nonempty reference",
    );
    check(
      e.expect !== "NON_EMPTY" || e.reference.length > 0,
      r.id,
      `${name}_reference`,
      "NON_EMPTY requires a semantic reference",
    );
    check(
      e.reference.every((text) =>
        e.forbidden_keywords.every((k) => !text.includes(k)),
      ),
      r.id,
      `${name}_reference_keywords`,
      "Reference contains universally forbidden keyword",
    );
  }
  const invalid = r.expected.invalidate_clarifications;
  check(
    invalid.expect === "EMPTY"
      ? invalid.ids.length === 0
      : invalid.ids.length > 0 &&
          new Set(invalid.ids).size === invalid.ids.length &&
          invalid.ids.every((id) =>
            r.input.current_clarifications.some((c) => c.id === id),
          ),
    r.id,
    "invalidate",
    JSON.stringify(invalid),
  );
  const promote = r.expected.promote_pile_item;
  check(
    promote.expect === "EMPTY"
      ? promote.id === null
      : promote.id !== null &&
          r.input.pile.some((p) => p.id === promote.id) &&
          r.expected.accept.every((a) => a === "SHIFT/HIGH"),
    r.id,
    "promote",
    JSON.stringify(promote),
  );
}
const byId = new Map(judge.map((r) => [r.id, r]));
function same(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b);
}
check(
  same(byId.get("J-HEDGE-01a")?.input, byId.get("J-HEDGE-01b")?.input),
  "J-HEDGE-01a/01b",
  "same_window",
  "Only history may differ",
);
check(
  same(
    byId.get("J-CARRY-01a")?.input.turns,
    byId.get("J-CARRY-01b")?.input.turns,
  ),
  "J-CARRY-01a/01b",
  "same_window",
  "Control pair window differs",
);
for (const [id, numerator] of [
  ["J-HEDGE-01a", 5],
  ["J-HEDGE-01b", 2],
] as const) {
  check(
    Object.values(hedge[id] ?? {}).length === 2 &&
      Object.values(hedge[id]).every(
        (h) => h.total === 6 && h.hedged === numerator,
      ),
    id,
    "control_ratio",
    `Expected ${numerator}/6`,
  );
}
for (const [target, source] of [
  ["J-CARRY-01a", "J-MED-05"],
  ["J-CARRY-01b", "J-MED-05"],
  ["J-CARRY-02", "J-MED-02"],
  ["J-CLOSE-03", "J-CLARI-01"],
])
  check(
    same(byId.get(target)?.fixture_meta.history, byId.get(source)?.input.turns),
    target,
    "history_copy",
    `History differs from ${source}`,
  );
const dialoguePatches = [
  ["J-NOT-02", "A2", "알바를 그만둘지는 어떤 게 정해져야 결정할 수 있어요?"],
  ["J-MED-02", "A2", "월세랑 관리비는 한 달에 얼마까지 감당할 수 있어요?"],
  ["J-CLOSE-03", "A4", "그 시간에 다른 걸 한다면 떠오르는 게 있어요?"],
];
for (const [id, turnId, text] of dialoguePatches)
  check(
    byId.get(id)?.input.turns.find((t) => t.id === turnId)?.text === text,
    id,
    "dialogue_patch",
    turnId,
  );
check(
  same(byId.get("J-CLOSE-01")?.expected.accept, ["CLOSE/*"]) &&
    same(byId.get("J-EDGE-01")?.expected.accept, ["SHIFT/HIGH"]),
  "CLOSE/EDGE",
  "opposite_labels",
  "Preserve user-defined opposite pair",
);

const mapping = z
  .object({
    classification_to_behavior: z.record(
      z.string(),
      z.record(z.string(), z.string()),
    ),
    category_to_contact: z.record(
      z.string(),
      z
        .object({ primary: z.string(), urgent: z.string().optional() })
        .nullable(),
    ),
  })
  .parse(
    JSON.parse(readFileSync(resolve(root, "eval/safety_mapping.json"), "utf8")),
  );
let mappedSafety = 0;
for (const r of safety) {
  check(
    r.depends_on.length === 0 && Array.isArray(r.candidates),
    r.id,
    "metadata",
    "v4 patch requires candidates and empty depends_on",
  );
  const category = r.expected.category;
  const behavior =
    category === null
      ? undefined
      : mapping.classification_to_behavior[r.expected.label]?.[category];
  check(
    behavior !== undefined,
    r.id,
    "mapping_category",
    `Unmapped ${r.expected.label}/${String(category)}`,
    "compatibility",
  );
  if (behavior === undefined || category === null) continue;
  mappedSafety++;
  check(
    behavior === r.expected.behavior,
    r.id,
    "mapping_behavior",
    `${behavior} != ${r.expected.behavior}`,
    "compatibility",
  );
  const contact = mapping.category_to_contact[category];
  const expectedNumbers = (
    r.expected.contact?.match(/\d{3,4}(?:-\d{4})?/g) ?? []
  ).sort();
  const actualNumbers = contact
    ? Object.values(contact)
        .filter((n): n is string => typeof n === "string")
        .sort()
    : [];
  check(
    same(expectedNumbers, actualNumbers),
    r.id,
    "mapping_contact_numbers",
    "Phone values differ; this is not a copy/tone or current official contact validation",
    "compatibility",
  );
}
for (const r of start) {
  check(
    r.expected.label === "REFRAME_NEEDED" ||
      r.expected.node0_reference === null,
    r.id,
    "start_reference",
    "Quick routing must not force a new Node 0",
  );
  check(
    !r.expected.node0_reference ||
      r.expected.forbidden_keywords.every(
        (k) => !r.expected.node0_reference!.includes(k),
      ),
    r.id,
    "start_keywords",
    "Reference includes forbidden words",
  );
}
const countBy = (values: string[]) =>
  Object.fromEntries(
    [...new Set(values)]
      .sort()
      .map((v) => [v, values.filter((x) => x === v).length]),
  );
console.log(
  JSON.stringify(
    {
      scope:
        "Static structure, references and declared patch checks; no model execution or quality score",
      files: {
        judge: judge.length,
        start: start.length,
        safety: safety.length,
      },
      modes: countBy(all.map((r) => r.mode)),
      startLabels: countBy(start.map((r) => r.expected.label)),
      hedgeControl: Object.fromEntries(
        ["J-HEDGE-01a", "J-HEDGE-01b"].map((id) => [id, hedge[id]]),
      ),
      mappedSafety,
      issues,
    },
    null,
    2,
  ),
);
if (issues.length > 0) process.exitCode = 1;
