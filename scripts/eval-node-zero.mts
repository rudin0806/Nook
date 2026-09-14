import OpenAI from "openai";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { executeNodeZero } from "../src/engine/start.ts";
import { startInputSchema } from "../src/schemas/start.ts";
import type { JsonTransport } from "../src/engine/json-model.ts";
import { formatProviderDiagnostic } from "./judge-model.mts";

const fixtureSchema = z.object({
  id: z.string(),
  mode: z.literal("strict"),
  input: startInputSchema,
  expected: z.object({
    label: z.enum(["NEEDS_INFO", "CLEAR_AS_IS", "REFRAME_NEEDED"]),
    forbidden_keywords: z.array(z.string().min(1)),
  }),
});
export function selectNodeFixtures(raw: unknown) {
  const all = z.array(fixtureSchema).length(17).parse(raw);
  const selected = all.filter((row) => row.expected.label === "REFRAME_NEEDED");
  const ids = Array.from(
    { length: 11 },
    (_, index) => `ST-${String(index + 6).padStart(2, "0")}`,
  );
  if (
    selected.length !== 11 ||
    selected.some((row, index) => row.id !== ids[index])
  )
    throw new Error("NODE_FIXTURE_SET_INVALID");
  return selected;
}
export async function evaluateNodeZero(raw: unknown, transport: JsonTransport) {
  const fixtures = selectNodeFixtures(raw);
  const report = {
    model: "gpt-5.6-sol",
    reasoningEffort: "high",
    maxOutputTokens: 2048,
    planned: 11,
    complete: false,
    automaticPass: false,
    semanticReview: "PENDING",
    cases: [] as {
      id: string;
      question: string;
      evidence_sentence: string;
      evidence_quotes: string[];
      forbiddenKeywords: string[];
    }[],
    error: null as null | { id: string; code: string },
  };
  for (const row of fixtures) {
    try {
      const output = await executeNodeZero(
        { ...row.input, selected_focus: null, focus_reply: null },
        {
          model: report.model,
          reasoningEffort: report.reasoningEffort,
          maxOutputTokens: report.maxOutputTokens,
        },
        transport,
      );
      // Quotations repeat fixture text; inspect newly generated claims separately.
      const generated = output.question + "\n" + output.evidence_sentence;
      report.cases.push({
        id: row.id,
        ...output,
        forbiddenKeywords: row.expected.forbidden_keywords.filter((word) =>
          generated.includes(word),
        ),
      });
    } catch (error) {
      const code =
        error instanceof Error &&
        /^NODE_ZERO_(PROVIDER_FAILED|RESPONSE_INCOMPLETE|OUTPUT_INVALID)$/.test(
          error.message,
        )
          ? error.message
          : "NODE_EVAL_FAILED";
      report.error = { id: row.id, code };
      return report;
    }
  }
  report.complete = true;
  report.automaticPass = report.cases.every(
    (row) => row.forbiddenKeywords.length === 0,
  );
  return report;
}

async function main() {
  if (process.argv.length !== 2 || !process.env.OPENAI_API_KEY)
    throw new Error("SETUP_FAILED");
  const paths = [
    "eval/start.jsonl",
    "src/prompts/prompt-node-zero.ts",
    "src/engine/start.ts",
    "src/engine/json-model.ts",
  ];
  const hashes = Object.fromEntries(
    paths.map((path) => [
      path,
      createHash("sha256").update(readFileSync(path)).digest("hex"),
    ]),
  );
  const raw: unknown = readFileSync(paths[0], "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  selectNodeFixtures(raw);
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    maxRetries: 0,
    timeout: 60_000,
  });
  const usage = { calls: 0, inputTokens: 0, outputTokens: 0 };
  const report = await evaluateNodeZero(raw, async (request) => {
    if (++usage.calls > 11) throw new Error("CALL_LIMIT");
    const response = await client.responses
      .create(request)
      .catch((error: unknown) => {
        console.error(formatProviderDiagnostic(error));
        throw error;
      });
    usage.inputTokens += response.usage?.input_tokens ?? 0;
    usage.outputTokens += response.usage?.output_tokens ?? 0;
    return response;
  });
  // Only fixed repository fixtures are accepted. Never use this logger for live user input.
  console.log(
    JSON.stringify(
      { commit: process.env.GITHUB_SHA ?? null, hashes, usage, ...report },
      null,
      2,
    ),
  );
  if (!report.automaticPass) process.exitCode = 1;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch(() => {
    console.error("NODE_EVAL_SETUP_FAILED");
    process.exitCode = 1;
  });
}
