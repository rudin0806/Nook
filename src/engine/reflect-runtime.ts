import {
  inspectReflectionQuestion,
  prepareReflection,
  REFLECT_QUESTION_LONG,
  ReflectionCenterRequiredError,
} from "./reflect.ts";
import {
  executeJson,
  prepareJsonRequest,
  type JsonTransport,
} from "./json-model.ts";
import type { PrepareJudgeOptions } from "./judge.ts";
import type { ReflectMode, ReflectOutput } from "../schemas/reflect.ts";
import { REFLECT_PROMPT_VERSION } from "../prompts/prompt-reflect.ts";

const SAFE_REFLECTION_FALLBACK_QUESTIONS = [
  "지금 질문에서 아직 남은 건 뭐예요?",
  "지금 가장 먼저 짚고 싶은 건 뭐예요?",
] as const;

type FallbackReason =
  | "OUTPUT_VALIDATION"
  | "QUESTION_NEWLINE"
  | "QUESTION_MARK_COUNT"
  | "QUESTION_MARK_END"
  | "QUESTION_TOO_LONG"
  | "QUESTION_DIAGNOSTIC"
  | "QUESTION_REPEATED"
  | "CENTER_REQUIRED";

const normalizeQuestion = (question: string) =>
  question.normalize("NFKC").replace(/[\s\p{P}]/gu, "");

function recover(
  reason: FallbackReason,
  mode: ReflectMode,
  lastQuestion: string | null,
) {
  // Deliberately omit model output and conversation text from diagnostics.
  console.warn(JSON.stringify({ evt: "nook_reflect_fallback", reason, mode }));
  const normalizedLast =
    lastQuestion === null ? null : normalizeQuestion(lastQuestion);
  const question =
    SAFE_REFLECTION_FALLBACK_QUESTIONS.find(
      (candidate) => normalizeQuestion(candidate) !== normalizedLast,
    ) ?? SAFE_REFLECTION_FALLBACK_QUESTIONS[0];
  return {
    scope: "CENTER",
    question,
    type: "PRESENT",
    move: "RECOVERY",
    source_turn: null,
    source_quote: null,
  } as const;
}

function rawQuestionHasNewline(value: unknown): boolean {
  if (typeof value !== "object" || value === null || !("question" in value))
    return false;
  const question = (value as { question?: unknown }).question;
  return typeof question === "string" && /[\r\n]/u.test(question);
}

function questionGateReason(
  output: ReflectOutput,
  lastQuestion: string | null,
  mustReturnToCenter: boolean,
): FallbackReason | null {
  const question = output.question;
  if (/[\r\n]/u.test(question)) return "QUESTION_NEWLINE";
  if ((question.match(/[?？]/gu) ?? []).length !== 1)
    return "QUESTION_MARK_COUNT";
  if (!/[?？]$/u.test(question)) return "QUESTION_MARK_END";
  if (question.replace(/\s/gu, "").length > REFLECT_QUESTION_LONG)
    return "QUESTION_TOO_LONG";
  if (inspectReflectionQuestion(question).length > 0)
    return "QUESTION_DIAGNOSTIC";
  if (
    lastQuestion !== null &&
    normalizeQuestion(question) === normalizeQuestion(lastQuestion)
  )
    return "QUESTION_REPEATED";
  if (mustReturnToCenter && output.scope !== "CENTER") return "CENTER_REQUIRED";
  return null;
}

export async function executeReflection(
  judge: unknown,
  context: unknown,
  options: PrepareJudgeOptions,
  transport: JsonTransport,
) {
  const prepared = prepareReflection(judge, context);
  if (prepared.user.length > 30000) throw new Error("REFLECT_INPUT_TOO_LARGE");
  const request = prepareJsonRequest(
    prepared.system,
    { context: prepared.user },
    options,
  );
  request.text.format = {
    type: "json_schema",
    name: "reflection_question",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: [
        "scope",
        "move",
        "question",
        "type",
        "source_turn",
        "source_quote",
      ],
      properties: {
        scope: {
          type: "string",
          enum: prepared.outputPolicy.requiredScope
            ? [prepared.outputPolicy.requiredScope]
            : ["CENTER", "DETAIL"],
        },
        move: { type: "string", enum: prepared.outputPolicy.allowedMoves },
        question: { type: "string" },
        type: { type: "string", enum: ["PRESENT", "PAST", "COMPARE"] },
        source_turn: { type: ["string", "null"] },
        source_quote: { type: ["string", "null"] },
      },
    },
  };
  const started = Date.now();
  let usage: { input_tokens?: number; output_tokens?: number } | undefined;
  // Parse the provider envelope and JSON exactly once. Valid JSON that fails the
  // bounded output contract recovers locally; transport and JSON failures remain
  // visible to the caller.
  const raw = await executeJson(
    request,
    (value) => value,
    async (modelRequest) => {
      const response = await transport(modelRequest);
      usage = response.usage;
      return response;
    },
    "REFLECT",
  );
  // reflectOutputSchema trims strings, so inspect the parsed JSON first to keep
  // leading/trailing newlines from being normalized into an accepted question.
  const finish = (output: ReflectOutput, fallback: boolean) => {
    console.log(
      JSON.stringify({
        evt: "nook_reflect",
        promptVersion: REFLECT_PROMPT_VERSION,
        mode: prepared.mode,
        model: request.model,
        fallback,
        ms: Date.now() - started,
        inputTokens: usage?.input_tokens ?? null,
        outputTokens: usage?.output_tokens ?? null,
      }),
    );
    return output;
  };
  const fallback = (reason: FallbackReason) =>
    finish(recover(reason, prepared.mode, prepared.lastQuestion), true);

  if (rawQuestionHasNewline(raw)) return fallback("QUESTION_NEWLINE");
  let output: ReflectOutput;
  try {
    output = prepared.validateOutput(raw);
  } catch (error) {
    return fallback(
      error instanceof ReflectionCenterRequiredError
        ? "CENTER_REQUIRED"
        : "OUTPUT_VALIDATION",
    );
  }
  const reason = questionGateReason(
    output,
    prepared.lastQuestion,
    prepared.mustReturnToCenter,
  );
  return reason ? fallback(reason) : finish(output, false);
}
