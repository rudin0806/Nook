import { safetyInputSchema } from "../schemas/safety.ts";
import { readModerationSignal } from "./moderation.ts";
import { executeSafety } from "./safety.ts";
import { prepareJsonRequest, type JsonTransport } from "./json-model.ts";
import type { PrepareJudgeOptions } from "./judge.ts";
export type ModerationTransport = (request: {
  model: "omni-moderation-latest";
  input: string;
}) => Promise<unknown>;

/** Complete internal gate. No DB writes, logging, retries or fallback-to-CONTINUE. */
export async function executeSafetyGate(
  raw: unknown,
  options: PrepareJudgeOptions,
  deps: { moderate: ModerationTransport; classify: JsonTransport },
) {
  const parsed = safetyInputSchema.safeParse(raw);
  if (!parsed.success) throw new Error("SAFETY_INPUT_INVALID");
  // Reject unsupported models/output budgets before any provider request.
  prepareJsonRequest("", {}, options);
  let response: unknown;
  try {
    // Moderate the current utterance. The classifier receives contextual history separately.
    response = await deps.moderate({
      model: "omni-moderation-latest",
      input: parsed.data.utterance,
    });
  } catch {
    throw new Error("MODERATION_PROVIDER_FAILED");
  }
  const signal = readModerationSignal(response);
  // Even an unflagged result must pass contextual classification (e.g. HANDOFF).
  return executeSafety(parsed.data, options, deps.classify, signal);
}
