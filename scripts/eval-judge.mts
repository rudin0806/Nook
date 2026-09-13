import OpenAI from "openai";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { resolve } from "node:path";
import {
  selectFixtures,
  evaluateJudge,
  formatProviderDiagnostic,
} from "./judge-model.mts";
import { loadEvalTrigger } from "./eval-trigger.mts";
import { type Fixture, run } from "./eval-core.mts";

async function main() {
  const { values } = parseArgs({
    options: {
      dry: { type: "boolean" },
      trigger: { type: "string" },
      model: { type: "string" },
      ids: { type: "string", default: "J-CLOSE-01,J-EDGE-01" },
      "max-cases": { type: "string", default: "2" },
      "max-output-tokens": { type: "string", default: "1024" },
    },
    strict: true,
  });
  const path = resolve(import.meta.dirname, "../eval/judge.jsonl");
  const all = readFileSync(path, "utf8")
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l)) as Fixture[];
  const trigger = values.trigger
    ? loadEvalTrigger(resolve(values.trigger))
    : null;
  const ids = trigger?.ids ?? values.ids.split(",");
  const maxCases = trigger?.maxCases ?? Number(values["max-cases"]);
  const maxOutputTokens =
    trigger?.maxOutputTokens ?? Number(values["max-output-tokens"]);
  const fixtures = selectFixtures(all, ids, maxCases);
  if (values.dry) {
    await run(path, null, ids);
    return;
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY_REQUIRED");
  const model = trigger?.model ?? values.model ?? process.env.NOOK_EVAL_MODEL;
  if (!model?.trim()) throw new Error("MODEL_REQUIRED");
  const client = new OpenAI({ apiKey, timeout: 30_000, maxRetries: 0 });
  const report = await evaluateJudge(
    fixtures,
    model,
    maxOutputTokens,
    (request) => client.responses.create(request),
    (error) => console.error(formatProviderDiagnostic(error)),
  );
  const dir = resolve(import.meta.dirname, "../eval/reports");
  mkdirSync(dir, { recursive: true });
  const filename = resolve(dir, `judge-${Date.now()}.json`);
  writeFileSync(filename, JSON.stringify(report, null, 2) + "\n", {
    flag: "wx",
    mode: 0o600,
  });
  console.log(JSON.stringify(report, null, 2));
  console.log(`Report: ${filename}`);
  if (!report.complete || report.cases.some((c) => c.failures.length))
    process.exitCode = 1;
}
main().catch((error) => {
  const safe = new Set([
    "OPENAI_API_KEY_REQUIRED",
    "MODEL_REQUIRED",
    "INVALID_CASE_LIMIT",
    "INVALID_CASE_IDS",
    "CASE_LIMIT_EXCEEDED",
    "UNKNOWN_OR_PENDING_CASE",
    "FIXTURE_INVALID",
    "INVALID_OUTPUT_LIMIT",
  ]);
  console.error(
    error instanceof Error && safe.has(error.message)
      ? error.message
      : "EVAL_SETUP_FAILED",
  );
  process.exitCode = 1;
});
