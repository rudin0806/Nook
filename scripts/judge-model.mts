import { createHash } from "node:crypto";
import { computeHedge } from "../src/engine/hedge.ts";
import { JUDGE_SYSTEM, buildJudgeUser } from "../src/prompts/prompt-judge.ts";
import { judgeOutputSchema, mediumReasonSchema } from "../src/schemas/judge.ts";
import {
  score,
  severity,
  validateFixtures,
  type Fixture,
} from "./eval-core.mts";

export type ModelRequest = {
  model: string;
  instructions: string;
  input: [
    {
      role: "user";
      content: [{ type: "input_text"; text: string }];
    },
  ];
  max_output_tokens: number;
  store: false;
  text: { format: { type: "json_object" } };
};
export type ModelResponse = {
  status?: string;
  output_text: string;
  model?: string;
  usage?: { input_tokens: number; output_tokens: number };
};
export type Transport = (request: ModelRequest) => Promise<ModelResponse>;
export type TransportErrorObserver = (error: unknown) => void;
export type CaseResult = {
  id: string;
  mode: Fixture["mode"];
  action: string | null;
  confidence: string | null;
  failures: string[];
  severity: string[];
  inputTokens: number;
  outputTokens: number;
  resolvedModel: string | null;
};

function safeErrorMetadata(value: unknown) {
  if (typeof value !== "string" || !/^[a-zA-Z0-9_.-]{1,64}$/.test(value)) {
    return null;
  }
  return value;
}

function classifyProviderMessage(value: unknown) {
  if (typeof value !== "string") return null;
  if (/safety|policy|unsafe|flagged|moderation/i.test(value))
    return "INPUT_POLICY";
  if (/json|response.?format|text\.format/i.test(value)) return "OUTPUT_FORMAT";
  if (/context|too long|maximum context|token limit/i.test(value))
    return "CONTEXT_LIMIT";
  if (/quota|billing|credit|spend/i.test(value)) return "BILLING";
  if (/model|access|permission/i.test(value)) return "MODEL_ACCESS";
  if (/input.*(type|format)|must be.*input|expected.*input/i.test(value))
    return "INPUT_SHAPE";
  return null;
}

export function formatProviderDiagnostic(error: unknown) {
  if (typeof error !== "object" || error === null) return "OPENAI_API_ERROR";
  const record = error as Record<string, unknown>;
  const parts = ["OPENAI_API_ERROR"];
  if (
    typeof record.status === "number" &&
    Number.isInteger(record.status) &&
    record.status >= 400 &&
    record.status <= 599
  ) {
    parts.push(`status=${record.status}`);
  }
  for (const field of ["code", "type", "param"] as const) {
    const value = safeErrorMetadata(record[field]);
    if (value) parts.push(`${field}=${value}`);
  }
  const category = classifyProviderMessage(record.message);
  if (category) parts.push(`category=${category}`);
  return parts.join(" ");
}

export function selectFixtures(
  fixtures: Fixture[],
  ids: string[],
  maxCases: number,
) {
  if (!Number.isInteger(maxCases) || maxCases < 1 || maxCases > 32)
    throw new Error("INVALID_CASE_LIMIT");
  if (!ids.length || new Set(ids).size !== ids.length)
    throw new Error("INVALID_CASE_IDS");
  if (ids.length > maxCases) throw new Error("CASE_LIMIT_EXCEEDED");
  const selected = ids.map((id) => {
    const f = fixtures.find((row) => row.id === id);
    if (!f || f.mode === "pending") throw new Error("UNKNOWN_OR_PENDING_CASE");
    return f;
  });
  if (validateFixtures(selected).length) throw new Error("FIXTURE_INVALID");
  return selected;
}

export function makeJudgeRequest(
  fixture: Fixture,
  model: string,
  maxOutputTokens: number,
): ModelRequest {
  if (!model.trim()) throw new Error("MODEL_REQUIRED");
  if (
    !Number.isInteger(maxOutputTokens) ||
    maxOutputTokens < 256 ||
    maxOutputTokens > 4096
  )
    throw new Error("INVALID_OUTPUT_LIMIT");
  const hedge = computeHedge([
    ...fixture.fixture_meta.history,
    ...fixture.input.turns,
  ]);
  if (hedge.hedgeSpeaker !== fixture.fixture_meta.expected_hedge_speaker)
    throw new Error("FIXTURE_INVALID");
  // Only fixture.input + computed flag reach the model. Gold answers, history,
  // source, rationale and expected values are never part of the model request.
  const input = {
    ...fixture.input,
    carryover: fixture.input.carryover.map((c) => ({
      ...c,
      medium_reason: mediumReasonSchema.parse(c.medium_reason),
    })),
  };
  return {
    model,
    instructions: JUDGE_SYSTEM,
    // Use an explicit Responses API message/content shape. This is semantically
    // identical to a bare string, but avoids provider-side ambiguity about input.
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: buildJudgeUser(input, hedge.hedgeSpeaker),
          },
        ],
      },
    ],
    max_output_tokens: maxOutputTokens,
    store: false,
    text: { format: { type: "json_object" } },
  };
}

export async function evaluateJudge(
  fixtures: Fixture[],
  model: string,
  maxOutputTokens: number,
  transport: Transport,
  onTransportError?: TransportErrorObserver,
) {
  // Validate the whole selected batch before the first billable request.
  const selected = selectFixtures(
    fixtures,
    fixtures.map((f) => f.id),
    32,
  );
  const requests = selected.map((f) =>
    makeJudgeRequest(f, model, maxOutputTokens),
  );
  const cases: CaseResult[] = [];
  for (let i = 0; i < selected.length; i++) {
    const f = selected[i];
    const result: CaseResult = {
      id: f.id,
      mode: f.mode,
      action: null,
      confidence: null,
      failures: [],
      severity: [],
      inputTokens: 0,
      outputTokens: 0,
      resolvedModel: null,
    };
    cases.push(result);
    let response: ModelResponse;
    try {
      response = await transport(requests[i]);
    } catch (error) {
      onTransportError?.(error);
      result.failures.push("API_ERROR");
      break;
    } // no retry or raw SDK error leakage
    result.inputTokens = response.usage?.input_tokens ?? 0;
    result.outputTokens = response.usage?.output_tokens ?? 0;
    result.resolvedModel = response.model ?? null;
    if (response.status !== "completed") {
      result.failures.push("INCOMPLETE_RESPONSE");
      continue;
    }
    let raw: unknown;
    try {
      raw = JSON.parse(response.output_text);
    } catch {
      result.failures.push("INVALID_JSON_OR_REFUSAL");
      continue;
    }
    const parsed = judgeOutputSchema.safeParse(raw);
    if (!parsed.success) {
      result.failures.push("SCHEMA");
      continue;
    }
    result.action = parsed.data.action;
    result.confidence = parsed.data.shift_confidence ?? null;
    result.failures = [...new Set(score(f, parsed.data).map((x) => x.kind))];
    result.severity = severity(f, parsed.data);
  }
  const strict = cases.filter((c) => c.mode === "strict");
  const counts: Record<string, number> = {};
  for (const c of strict)
    for (const key of [...c.failures, ...c.severity])
      counts[key] = (counts[key] ?? 0) + 1;
  return {
    scope:
      "Judge deterministic checks only; semantic review, Start and Safety not evaluated",
    model,
    promptSha256: createHash("sha256").update(JUDGE_SYSTEM).digest("hex"),
    fixtureSha256: createHash("sha256")
      .update(JSON.stringify(selected))
      .digest("hex"),
    requestedCases: selected.length,
    attemptedCases: cases.length,
    complete:
      cases.length === selected.length &&
      !cases.some((c) => c.failures.includes("API_ERROR")),
    strict: {
      total: strict.length,
      passed: strict.filter((c) => !c.failures.length).length,
      actionMatched: strict.filter(
        (c) => c.action !== null && !c.failures.includes("ACTION"),
      ).length,
    },
    errors: counts,
    cases,
  };
}
