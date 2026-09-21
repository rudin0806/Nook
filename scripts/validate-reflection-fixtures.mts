import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { prepareReflection } from "../src/engine/reflect.ts";
import { hasExplicitCorrection } from "../src/engine/correction.ts";
import { judgeOutputSchema } from "../src/schemas/judge.ts";
import {
  questionMoveSchema,
  questionScopeSchema,
  reflectContextSchema,
  reflectModeSchema,
} from "../src/schemas/reflect.ts";

// Static Prompt D fixture validation only. This script never calls a model or API.
const root = resolve(import.meta.dirname, "..");
const fixturePath = resolve(root, "eval", "reflection.jsonl");

const requiredClasses = [
  "CORRECTION",
  "CORRECTION_HOLDOUT",
  "CONFUSED",
  "NON_ANSWER",
  "DETAIL_STREAK_RETURN",
  "MEDIUM_SINGLE_SPONTANEOUS",
  "MEDIUM_ALL_HEDGED",
  "MEDIUM_AI_LED",
  "ALREADY_ANSWERED_CLOSE_CAUTION",
  "PAINFUL_EVENT",
  "REPEATED_TEMPLATE",
  "SHORT_ANSWERS",
  "UNRELATED_DIRECTION",
  "CLOSURE_DECLINED",
] as const;

const fixtureSchema = z.strictObject({
  id: z.string().regex(/^D-[A-Z0-9-]+$/),
  class: z.enum(requiredClasses),
  split: z.enum(["development", "holdout"]),
  mode: z.enum(["strict", "boundary"]),
  rationale: z.string().trim().min(1),
  judge: judgeOutputSchema,
  context: reflectContextSchema,
  expected: z.strictObject({
    mode: reflectModeSchema,
    scope: questionScopeSchema,
    allowed_moves: z.array(questionMoveSchema).min(1),
    forbidden_fragments: z.array(z.string().trim().min(2)).min(1),
  }),
});

type Fixture = z.infer<typeof fixtureSchema>;
const issues: string[] = [];
const raw = readFileSync(fixturePath, "utf8");
const lines = raw.split(/\r?\n/);
if (lines.at(-1) === "") lines.pop();
if (lines.some((line) => line.trim() === ""))
  issues.push("reflection.jsonl: blank lines are not allowed");

const fixtures: Fixture[] = [];
for (const [index, line] of lines.entries()) {
  try {
    fixtures.push(fixtureSchema.parse(JSON.parse(line)));
  } catch (error) {
    issues.push(`reflection.jsonl:${index + 1}: ${String(error)}`);
  }
}

function check(ok: boolean, id: string, detail: string) {
  if (!ok) issues.push(`${id}: ${detail}`);
}

check(
  lines.length === requiredClasses.length,
  "reflection.jsonl",
  `expected ${requiredClasses.length} rows, found ${lines.length}`,
);
check(
  fixtures.length === lines.length,
  "reflection.jsonl",
  "one or more rows failed schema validation",
);
check(
  new Set(fixtures.map((fixture) => fixture.id)).size === fixtures.length,
  "reflection.jsonl",
  "fixture ids must be unique",
);

const representedClasses = new Set(fixtures.map((fixture) => fixture.class));
for (const requiredClass of requiredClasses)
  check(
    representedClasses.has(requiredClass),
    "reflection.jsonl",
    `missing class ${requiredClass}`,
  );
check(
  representedClasses.size === requiredClasses.length,
  "reflection.jsonl",
  "each required class must appear exactly once",
);
check(
  new Set(fixtures.map((fixture) => fixture.expected.scope)).size === 2,
  "reflection.jsonl",
  "both CENTER and DETAIL scope expectations must be represented",
);
check(
  new Set(fixtures.map((fixture) => fixture.expected.mode)).size === 6,
  "reflection.jsonl",
  "all six deterministic reflection modes must be represented",
);
check(
  new Set(fixtures.flatMap((fixture) => fixture.expected.allowed_moves))
    .size === questionMoveSchema.options.length,
  "reflection.jsonl",
  "all question moves must be represented by allowed_moves",
);

const expectedMediumReason = new Map<string, string>([
  ["MEDIUM_SINGLE_SPONTANEOUS", "SINGLE_SPONTANEOUS"],
  ["MEDIUM_ALL_HEDGED", "ALL_HEDGED"],
  ["MEDIUM_AI_LED", "AI_LED_WITH_USER_MATERIAL"],
]);

for (const fixture of fixtures) {
  const at = (ok: boolean, detail: string) => check(ok, fixture.id, detail);
  at(fixture.judge.action === "REFLECT", "fixed Judge output must be REFLECT");

  let preparedMode: string | undefined;
  try {
    preparedMode = prepareReflection(fixture.judge, fixture.context).mode;
  } catch (error) {
    issues.push(
      `${fixture.id}: Judge/context pair is not runnable: ${String(error)}`,
    );
  }
  at(
    preparedMode === fixture.expected.mode,
    `expected mode ${fixture.expected.mode}, prepared ${preparedMode ?? "unavailable"}`,
  );
  at(
    fixture.context.corrected_previous_frame ===
      hasExplicitCorrection(fixture.context.turns),
    "corrected_previous_frame must match the deterministic correction detector",
  );

  const referenceIds = [
    ...fixture.context.turns.map((turn) => turn.id),
    ...fixture.context.carryover.map((turn) => turn.turn),
  ];
  at(
    new Set(referenceIds).size === referenceIds.length,
    "turn and carryover ids must be unique",
  );
  for (const turn of fixture.context.turns) {
    at(/^[UA]\d+$/.test(turn.id), `invalid turn id ${turn.id}`);
    at(
      turn.id.startsWith(turn.role === "user" ? "U" : "A"),
      `turn role/id mismatch for ${turn.id}`,
    );
  }
  at(
    new Set(fixture.context.current_clarifications.map((item) => item.id))
      .size === fixture.context.current_clarifications.length,
    "clarification ids must be unique within a fixture",
  );

  const normalizedFragments = fixture.expected.forbidden_fragments.map(
    (fragment) => fragment.normalize("NFC").toLocaleLowerCase("ko-KR"),
  );
  at(
    new Set(normalizedFragments).size === normalizedFragments.length,
    "forbidden fragments must be unique after normalization",
  );
  at(
    new Set(fixture.expected.allowed_moves).size ===
      fixture.expected.allowed_moves.length,
    "allowed_moves must be unique",
  );
  const recoveryMode = [
    "CORRECTION",
    "CONFUSED",
    "NON_ANSWER",
    "RETURN_CENTER",
  ].includes(fixture.expected.mode);
  at(
    recoveryMode
      ? fixture.expected.allowed_moves.length === 1 &&
          fixture.expected.allowed_moves[0] === "RECOVERY"
      : !fixture.expected.allowed_moves.includes("RECOVERY"),
    recoveryMode
      ? "recovery modes allow only RECOVERY"
      : "DEFAULT and MEDIUM cannot allow RECOVERY",
  );

  const mediumReason = expectedMediumReason.get(fixture.class);
  if (mediumReason) {
    at(
      fixture.judge.shift_confidence === "MEDIUM",
      `${fixture.class} requires REFLECT/MEDIUM`,
    );
    at(
      fixture.judge.medium_reason === mediumReason,
      `${fixture.class} requires medium_reason ${mediumReason}`,
    );
  }

  if (["CORRECTION", "CORRECTION_HOLDOUT"].includes(fixture.class))
    at(
      fixture.context.corrected_previous_frame,
      "correction classes require corrected_previous_frame=true",
    );
  if (fixture.class === "CORRECTION_HOLDOUT")
    at(
      fixture.split === "holdout",
      "correction holdout must use holdout split",
    );
  else
    at(
      fixture.split === "development",
      "only the correction holdout is held out",
    );
  if (fixture.class === "CONFUSED")
    at(fixture.context.confused, "CONFUSED requires confused=true");
  if (fixture.class === "NON_ANSWER")
    at(fixture.context.non_answer, "NON_ANSWER requires non_answer=true");
  if (fixture.class === "DETAIL_STREAK_RETURN")
    at(
      fixture.context.detail_streak >= 2,
      "DETAIL_STREAK_RETURN requires detail_streak >= 2",
    );
  if (fixture.class === "SHORT_ANSWERS")
    at(fixture.context.stalled, "SHORT_ANSWERS requires stalled=true");
  if (
    [
      "ALREADY_ANSWERED_CLOSE_CAUTION",
      "REPEATED_TEMPLATE",
      "CLOSURE_DECLINED",
    ].includes(fixture.class)
  )
    at(
      fixture.context.last_question !== null,
      `${fixture.class} requires last_question`,
    );
  if (fixture.class === "UNRELATED_DIRECTION")
    at(
      fixture.judge.shift_confidence === "LOW",
      "UNRELATED_DIRECTION locks the external decision to REFLECT/LOW",
    );
  if (fixture.class === "CLOSURE_DECLINED") {
    at(
      fixture.context.turns.some(
        (turn) =>
          turn.role === "assistant" && /(?:마치|마칠|남기고)/u.test(turn.text),
      ),
      "CLOSURE_DECLINED needs the declined closure in context",
    );
    at(
      fixture.context.turns.at(-1)?.text.includes("더 생각") === true,
      "CLOSURE_DECLINED needs an explicit continue choice",
    );
  }
}

if (issues.length) {
  console.error(`Reflection fixture validation failed (${issues.length})`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log(
    `Reflection fixtures OK: ${fixtures.length} rows, ${representedClasses.size} classes, no API calls`,
  );
}
