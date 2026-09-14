import OpenAI from "openai";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { prepareJudge } from "../src/engine/judge.ts";
import { executeJson } from "../src/engine/json-model.ts";
import { executeReframe } from "../src/engine/reframe.ts";
import { executeReflection } from "../src/engine/reflect-runtime.ts";
import { formatProviderDiagnostic } from "./judge-model.mts";
import { judgeInputSchema } from "../src/schemas/judge.ts";
import { z } from "zod";

const ids = [
  "J-SHIFT-01",
  "J-SHIFT-03",
  "J-EDGE-01",
  "J-NOT-01",
  "J-MED-01",
  "J-MED-03",
];
const options = {
  model: "gpt-5.6-sol",
  reasoningEffort: "high",
  maxOutputTokens: 2048,
};
async function main() {
  if (!process.env.OPENAI_API_KEY || process.argv.length !== 2)
    throw Error("EVAL_SETUP_INVALID");
  const all = z
    .array(
      z.object({
        id: z.string(),
        mode: z.literal("strict").or(z.literal("boundary")),
        input: judgeInputSchema,
        expected: z.object({ accept: z.array(z.string()) }),
        fixture_meta: z.object({ history: z.array(z.unknown()) }),
      }),
    )
    .length(32)
    .parse(
      readFileSync("eval/judge.jsonl", "utf8")
        .trim()
        .split("\n")
        .map((l) => JSON.parse(l)),
    );
  const selected = ids.map((id) => {
    const matches = all.filter((r) => r.id === id);
    if (matches.length !== 1 || matches[0].fixture_meta.history.length)
      throw Error("EVAL_FIXTURE_INVALID");
    return matches[0];
  });
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    maxRetries: 0,
    timeout: 60000,
  });
  const usage = { calls: 0, inputTokens: 0, outputTokens: 0 };
  const transport = async (
    request: Parameters<typeof client.responses.create>[0],
  ) => {
    if (++usage.calls > 12) throw Error("CALL_LIMIT");
    const r = await client.responses
      .create({ ...request, stream: false })
      .catch((e) => {
        console.error(formatProviderDiagnostic(e));
        throw e;
      });
    usage.inputTokens += r.usage?.input_tokens ?? 0;
    usage.outputTokens += r.usage?.output_tokens ?? 0;
    return r;
  };
  const rows: unknown[] = [];
  let complete = true;
  for (const row of selected) {
    try {
      const judge = prepareJudge(row.input, row.input.turns, options);
      const output = await executeJson(
        judge.request,
        judge.validateOutput,
        transport,
        "JUDGE",
      );
      const classification = `${output.action}/${output.shift_confidence ?? "*"}`;
      if (!row.expected.accept.includes(classification)) {
        rows.push({
          id: row.id,
          classification,
          error: "JUDGE_ROUTE_MISMATCH",
        });
        complete = false;
        break;
      }
      if (output.action === "SHIFT") {
        const generated = await executeReframe(
          output,
          row.input,
          row.input.turns,
          options,
          transport,
        );
        rows.push({
          id: row.id,
          classification,
          output: generated.output,
          evidence: output.evidence_turns,
        });
      } else if (output.action === "REFLECT") {
        const generated = await executeReflection(
          output,
          {
            main_question: row.input.main_question,
            past_probe_count: 0,
            last_question_type: null,
            current_clarifications: row.input.current_clarifications.map(
              (c) => ({ id: c.id, text: c.text }),
            ),
            turns: row.input.turns,
            carryover: row.input.carryover.map((c) => ({
              turn: c.turn,
              text: c.text,
            })),
          },
          options,
          transport,
        );
        rows.push({
          id: row.id,
          classification,
          output: generated,
          evidence: output.evidence_turns,
        });
      } else {
        complete = false;
        rows.push({ id: row.id, error: "UNEXPECTED_CLOSE" });
        break;
      }
    } catch {
      complete = false;
      rows.push({ id: row.id, error: "GENERATION_FAILED" });
      break;
    }
  }
  const hashes = Object.fromEntries(
    [
      "eval/judge.jsonl",
      "src/prompts/prompt-reframe.ts",
      "src/prompts/prompt-reflect.ts",
      "src/engine/reframe.ts",
      "src/engine/reflect-runtime.ts",
    ].map((p) => [
      p,
      createHash("sha256").update(readFileSync(p)).digest("hex"),
    ]),
  );
  console.log(
    JSON.stringify(
      {
        commit: process.env.GITHUB_SHA,
        model: options.model,
        reasoning: options.reasoningEffort,
        hashes,
        usage,
        complete,
        semanticReview: "PENDING",
        scope:
          "Six existing fixture contexts. Actual Judge then C/D; no DB or live user input. Not a whole-dialogue quality score.",
        rows,
      },
      null,
      2,
    ),
  );
  if (!complete) process.exitCode = 1;
}
main().catch(() => {
  console.error("CONVERSATION_EVAL_SETUP_FAILED");
  process.exitCode = 1;
});
