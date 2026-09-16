import OpenAI from "openai";
import { readFileSync, writeFileSync } from "node:fs";
import {
  makeJudgeRequest,
  selectFixtures,
  formatProviderDiagnostic,
} from "./judge-model.mts";
import { score, type Fixture } from "./eval-core.mts";
import { prepareReframe } from "../src/engine/reframe.ts";
import { prepareJsonRequest } from "../src/engine/json-model.ts";
import { NODE_ZERO_SYSTEM } from "../src/prompts/prompt-node-zero.ts";
import { nodeZeroOutputSchema } from "../src/schemas/start.ts";

const options = {
  model: "gpt-5.6-sol",
  reasoningEffort: "high",
  maxOutputTokens: 2048,
};
const all = readFileSync("eval/judge.jsonl", "utf8")
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line) as Fixture);
const selected = selectFixtures(
  all,
  ["J-CLAIM-01", "J-CLAIM-02", "J-CLAIM-03"],
  3,
);
const rawThought =
  "팀장이 나를 싫어해서 일을 안 주는 거야. 이런 회사에서 계속 일할까?";
const turns = [
  {
    id: "U1",
    role: "user",
    text: "팀장이 나를 싫어해서 일을 안 주는 거야. 이직할까 고민했어.",
  },
  {
    id: "U2",
    role: "user",
    text: "지금은 이직보다 팀장이 나를 싫어한다고 생각하게 된 근거가 있는지부터 알고 싶어.",
  },
  {
    id: "U3",
    role: "user",
    text: "맞아. 먼저 확인하려는 건 팀장이 나를 싫어한다는 내 생각의 근거야.",
  },
];
const input = {
  main_question: "이직할까?",
  main_path: ["이직할까?"],
  pile: [],
  current_clarifications: [],
  carryover: [],
  turns,
};
// Fixed trusted SHIFT context isolates Reframe; this does not call Judge.
const reframe = prepareReframe(
  {
    action: "SHIFT",
    shift_confidence: "HIGH",
    medium_reason: null,
    evidence_turns: ["U2", "U3"],
    clarifications: [],
    branches: [],
    invalidate_clarifications: [],
    promote_pile_item: null,
  },
  input,
  turns,
  options,
);
const jobs = [
  ...selected.map((fixture) => ({
    id: fixture.id,
    request: makeJudgeRequest(fixture, options.model, 2048, "high"),
    validate: (raw: unknown) => {
      const failures = score(fixture, raw);
      if (failures.length) throw Error("JUDGE_CHECK_FAILED");
      return raw;
    },
  })),
  {
    id: "CLAIM-NODE-ZERO",
    request: prepareJsonRequest(
      NODE_ZERO_SYSTEM,
      { raw_thought: rawThought, selected_focus: null, focus_reply: null },
      options,
    ),
    validate: (raw: unknown) => {
      const result = nodeZeroOutputSchema.parse(raw);
      if (result.evidence_quotes.some((quote) => !rawThought.includes(quote)))
        throw Error("QUOTE_INVALID");
      return result;
    },
  },
  {
    id: "CLAIM-REFRAME",
    request: reframe.request,
    validate: (raw: unknown) =>
      reframe.validateResponseText(JSON.stringify(raw)),
  },
];
async function main() {
  if (process.argv.slice(2).join(" ") === "--dry") {
    console.log(
      JSON.stringify({
        planned: jobs.map((job) => job.id),
        maxCalls: 5,
        retries: 0,
        options,
        calls: 0,
      }),
    );
    return;
  }
  const generatorsOnly =
    process.argv.slice(2).join(" ") === "--generators-only";
  if (
    (!generatorsOnly && process.argv.length !== 2) ||
    !process.env.OPENAI_API_KEY
  )
    throw Error("EVAL_SETUP_INVALID");
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    maxRetries: 0,
    timeout: 60000,
  });
  const report = {
    options,
    maxCalls: generatorsOnly ? 2 : 5,
    previousCalls: generatorsOnly ? 4 : 0,
    calls: 0,
    inputTokens: 0,
    outputTokens: 0,
    semanticReview: "PENDING",
    diagnostic: null as string | null,
    cases: [] as unknown[],
    error: null as string | null,
  };
  try {
    for (const job of generatorsOnly ? jobs.slice(3) : jobs) {
      if (report.calls >= report.maxCalls) throw Error("CALL_LIMIT");
      report.calls++;
      const response = await client.responses.create({
        ...job.request,
        stream: false,
      });
      report.inputTokens += response.usage?.input_tokens ?? 0;
      report.outputTokens += response.usage?.output_tokens ?? 0;
      report.cases.push({
        id: job.id,
        responseId: response.id,
        output: response.output_text,
      });
      if (response.status !== "completed") throw Error("RESPONSE_INCOMPLETE");
      job.validate(JSON.parse(response.output_text));
    }
  } catch (error) {
    report.diagnostic =
      formatProviderDiagnostic(error) || "NO_SAFE_PROVIDER_DIAGNOSTIC";
    report.error = "EVALUATION_STOPPED_REVIEW_LAST_CASE";
    process.exitCode = 1;
  } finally {
    writeFileSync(
      "docs/reviews/data/claim-fidelity-five.json",
      JSON.stringify(report, null, 2),
    );
    console.log(
      JSON.stringify({
        calls: report.calls,
        error: report.error,
        semanticReview: report.semanticReview,
      }),
    );
  }
}
main().catch(() => {
  console.error("EVAL_SETUP_INVALID_NO_CALLS");
  process.exitCode = 1;
});
