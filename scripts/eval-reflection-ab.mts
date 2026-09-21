import OpenAI from "openai";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

type Variant = "baseline" | "candidate";
type Fixture = {
  id: string;
  class: string;
  judge: unknown;
  context: {
    last_question: string | null;
    [key: string]: unknown;
  };
  expected: {
    scope: "CENTER" | "DETAIL";
    allowed_moves: string[];
    forbidden_fragments: string[];
  };
};
type Usage = {
  calls: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
};
type CaseResult = {
  id: string;
  class: string;
  variant: Variant;
  output: unknown;
  providerOutput: unknown;
  fallback: boolean;
  hardFailures: string[];
  usage: Omit<Usage, "calls">;
  latencyMs: number;
  error: string | null;
};
type RuntimeModule = {
  executeReflection: (
    judge: unknown,
    context: unknown,
    options: {
      model: string;
      reasoningEffort: string;
      maxOutputTokens: number;
    },
    transport: (request: Record<string, unknown>) => Promise<{
      status?: string;
      output_text: string;
      model?: string;
      usage?: { input_tokens?: number; output_tokens?: number };
    }>,
  ) => Promise<unknown>;
};

const MODEL = "gpt-5.6-terra";
const REASONING = "medium";
const MAX_OUTPUT_TOKENS = 512;
const CALL_LIMIT = 28;
const INPUT_PRICE = 2 / 1_000_000;
const CACHED_INPUT_PRICE = 0.2 / 1_000_000;
const OUTPUT_PRICE = 12 / 1_000_000;

function arg(name: string) {
  const prefix = `--${name}=`;
  return process.argv
    .find((value) => value.startsWith(prefix))
    ?.slice(prefix.length);
}

const candidateRoot = resolve(arg("candidate-root") ?? process.cwd());
const baselineRoot = resolve(arg("baseline-root") ?? "");
const dry = process.argv.includes("--dry");
if (!baselineRoot || process.argv.some((value) => value.startsWith("--model=")))
  throw new Error("EVAL_SETUP_INVALID");

function loadFixtures(): Fixture[] {
  const rows = readFileSync(
    resolve(candidateRoot, "eval/reflection.jsonl"),
    "utf8",
  )
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as Fixture);
  if (rows.length !== 14 || new Set(rows.map((row) => row.id)).size !== 14)
    throw new Error("FIXTURE_COUNT_INVALID");
  return rows;
}

async function loadRuntime(root: string): Promise<RuntimeModule> {
  return import(
    pathToFileURL(resolve(root, "src/engine/reflect-runtime.ts")).href
  ) as Promise<RuntimeModule>;
}

const normalize = (value: string) =>
  value.normalize("NFKC").replace(/[\s\p{P}]/gu, "");

function questionOf(value: unknown): string | null {
  if (typeof value !== "object" || value === null || !("question" in value))
    return null;
  return typeof value.question === "string" ? value.question : null;
}

function hardFailures(
  fixture: Fixture,
  variant: Variant,
  output: unknown,
): string[] {
  if (typeof output !== "object" || output === null) return ["OUTPUT_MISSING"];
  const record = output as Record<string, unknown>;
  const question = questionOf(output);
  const failures: string[] = [];
  if (!question) return ["QUESTION_MISSING"];
  if (/[\r\n]/u.test(question)) failures.push("QUESTION_NEWLINE");
  if ((question.match(/[?？]/gu) ?? []).length !== 1)
    failures.push("QUESTION_MARK_COUNT");
  if (!/[?？]$/u.test(question)) failures.push("QUESTION_MARK_END");
  if (question.replace(/\s/gu, "").length > 40)
    failures.push("QUESTION_TOO_LONG");
  if (
    fixture.context.last_question &&
    normalize(question) === normalize(fixture.context.last_question)
  )
    failures.push("QUESTION_REPEATED");
  if (
    fixture.expected.forbidden_fragments.some((fragment) =>
      question.includes(fragment),
    )
  )
    failures.push("FORBIDDEN_FRAGMENT");
  if (record.scope !== fixture.expected.scope) failures.push("SCOPE");
  if (
    variant === "candidate" &&
    (typeof record.move !== "string" ||
      !fixture.expected.allowed_moves.includes(record.move))
  )
    failures.push("MOVE");
  return [...new Set(failures)];
}

function safeError(error: unknown) {
  return error instanceof Error && /^[A-Z][A-Z0-9_]{2,80}$/u.test(error.message)
    ? error.message
    : "EVAL_OUTPUT_INVALID";
}

function parseProviderOutput(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function isFallback(output: unknown, providerOutput: unknown) {
  const finalQuestion = questionOf(output);
  const providerQuestion = questionOf(providerOutput);
  return finalQuestion !== null && finalQuestion !== providerQuestion;
}

function cost(usage: Usage) {
  const uncached = Math.max(0, usage.inputTokens - usage.cachedInputTokens);
  return (
    uncached * INPUT_PRICE +
    usage.cachedInputTokens * CACHED_INPUT_PRICE +
    usage.outputTokens * OUTPUT_PRICE
  );
}

async function main() {
  const fixtures = loadFixtures();
  const [baseline, candidate] = await Promise.all([
    loadRuntime(baselineRoot),
    loadRuntime(candidateRoot),
  ]);

  for (const fixture of fixtures) {
    await baseline
      .executeReflection(
        fixture.judge,
        fixture.context,
        {
          model: MODEL,
          reasoningEffort: REASONING,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
        },
        async () => {
          throw new Error("DRY_TRANSPORT_CALLED");
        },
      )
      .catch((error) => {
        if (
          !(error instanceof Error) ||
          error.message !== "REFLECT_PROVIDER_FAILED"
        )
          throw error;
      });
    await candidate
      .executeReflection(
        fixture.judge,
        fixture.context,
        {
          model: MODEL,
          reasoningEffort: REASONING,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
        },
        async () => {
          throw new Error("DRY_TRANSPORT_CALLED");
        },
      )
      .catch((error) => {
        if (
          !(error instanceof Error) ||
          error.message !== "REFLECT_PROVIDER_FAILED"
        )
          throw error;
      });
  }

  if (dry) {
    console.log(
      JSON.stringify({
        dry: true,
        fixtures: fixtures.length,
        plannedCalls: fixtures.length * 2,
        callLimit: CALL_LIMIT,
        model: MODEL,
        reasoning: REASONING,
      }),
    );
    return;
  }
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY_REQUIRED");

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    maxRetries: 0,
    timeout: 60_000,
  });
  const totalUsage: Usage = {
    calls: 0,
    inputTokens: 0,
    cachedInputTokens: 0,
    outputTokens: 0,
  };
  const byVariant: Record<Variant, Usage> = {
    baseline: {
      calls: 0,
      inputTokens: 0,
      cachedInputTokens: 0,
      outputTokens: 0,
    },
    candidate: {
      calls: 0,
      inputTokens: 0,
      cachedInputTokens: 0,
      outputTokens: 0,
    },
  };
  const results: CaseResult[] = [];
  let providerFailed = false;

  async function runCase(
    runtime: RuntimeModule,
    variant: Variant,
    fixture: Fixture,
  ) {
    let providerOutput: unknown = null;
    let callUsage = { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 };
    const started = Date.now();
    let output: unknown = null;
    let error: string | null = null;
    try {
      output = await runtime.executeReflection(
        fixture.judge,
        fixture.context,
        {
          model: MODEL,
          reasoningEffort: REASONING,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
        },
        async (request) => {
          if (++totalUsage.calls > CALL_LIMIT) throw new Error("CALL_LIMIT");
          byVariant[variant].calls += 1;
          const response = await client.responses.create({
            ...(request as Parameters<typeof client.responses.create>[0]),
            stream: false,
          });
          providerOutput = parseProviderOutput(response.output_text);
          callUsage = {
            inputTokens: response.usage?.input_tokens ?? 0,
            cachedInputTokens:
              response.usage?.input_tokens_details?.cached_tokens ?? 0,
            outputTokens: response.usage?.output_tokens ?? 0,
          };
          totalUsage.inputTokens += callUsage.inputTokens;
          totalUsage.cachedInputTokens += callUsage.cachedInputTokens;
          totalUsage.outputTokens += callUsage.outputTokens;
          byVariant[variant].inputTokens += callUsage.inputTokens;
          byVariant[variant].cachedInputTokens += callUsage.cachedInputTokens;
          byVariant[variant].outputTokens += callUsage.outputTokens;
          return response;
        },
      );
    } catch (caught) {
      error = safeError(caught);
      if (error === "REFLECT_PROVIDER_FAILED") providerFailed = true;
    }
    results.push({
      id: fixture.id,
      class: fixture.class,
      variant,
      output,
      providerOutput,
      fallback: isFallback(output, providerOutput),
      hardFailures: output ? hardFailures(fixture, variant, output) : [],
      usage: callUsage,
      latencyMs: Date.now() - started,
      error,
    });
  }

  for (const fixture of fixtures) {
    await runCase(baseline, "baseline", fixture);
    if (providerFailed) break;
    await runCase(candidate, "candidate", fixture);
    if (providerFailed) break;
  }

  const blindRows = fixtures.map((fixture) => {
    const baselineResult = results.find(
      (row) => row.id === fixture.id && row.variant === "baseline",
    );
    const candidateResult = results.find(
      (row) => row.id === fixture.id && row.variant === "candidate",
    );
    const candidateIsA =
      createHash("sha256").update(fixture.id).digest()[0] % 2 === 0;
    const view = (row: CaseResult | undefined) => ({
      question: questionOf(row?.output),
      scope:
        typeof row?.output === "object" && row.output !== null
          ? ((row.output as Record<string, unknown>).scope ?? null)
          : null,
      error: row?.error ?? "NOT_ATTEMPTED",
      hardFailures: row?.hardFailures ?? [],
    });
    return {
      id: fixture.id,
      class: fixture.class,
      main_question: fixture.context.main_question,
      last_question: fixture.context.last_question,
      A: view(candidateIsA ? candidateResult : baselineResult),
      B: view(candidateIsA ? baselineResult : candidateResult),
    };
  });
  const blindMap = Object.fromEntries(
    fixtures.map((fixture) => {
      const candidateIsA =
        createHash("sha256").update(fixture.id).digest()[0] % 2 === 0;
      return [
        fixture.id,
        {
          A: candidateIsA ? "candidate" : "baseline",
          B: candidateIsA ? "baseline" : "candidate",
        },
      ];
    }),
  );
  const candidateResults = results.filter((row) => row.variant === "candidate");
  const complete = totalUsage.calls === CALL_LIMIT && !providerFailed;
  const candidateHardPass =
    candidateResults.length === fixtures.length &&
    candidateResults.every(
      (row) => row.error === null && row.hardFailures.length === 0,
    );
  const report = {
    commit: process.env.GITHUB_SHA ?? null,
    baselineCommit: "8e3d535983586a0b6b0258a0a8be49aa4d3a963e",
    model: MODEL,
    reasoning: REASONING,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    fixtureCount: fixtures.length,
    complete,
    candidateHardPass,
    semanticReview: "PENDING_BLIND_REVIEW",
    usage: {
      total: { ...totalUsage, estimatedUsd: cost(totalUsage) },
      baseline: {
        ...byVariant.baseline,
        estimatedUsd: cost(byVariant.baseline),
      },
      candidate: {
        ...byVariant.candidate,
        estimatedUsd: cost(byVariant.candidate),
      },
    },
    results,
  };
  const outputDirectory = resolve(candidateRoot, "artifacts/evaluations");
  mkdirSync(outputDirectory, { recursive: true });
  writeFileSync(
    resolve(outputDirectory, "reflection-ab.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  writeFileSync(
    resolve(outputDirectory, "reflection-ab-blind.json"),
    JSON.stringify(blindRows, null, 2) + "\n",
  );
  writeFileSync(
    resolve(outputDirectory, "reflection-ab-map.json"),
    JSON.stringify(blindMap, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({
      complete,
      candidateHardPass,
      calls: totalUsage.calls,
      inputTokens: totalUsage.inputTokens,
      cachedInputTokens: totalUsage.cachedInputTokens,
      outputTokens: totalUsage.outputTokens,
      estimatedUsd: cost(totalUsage),
      candidateFallbacks: candidateResults.filter((row) => row.fallback).length,
    }),
  );
  if (!complete || !candidateHardPass) process.exitCode = 1;
}

main().catch((error) => {
  console.error(safeError(error));
  process.exitCode = 1;
});
