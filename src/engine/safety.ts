import mapping from "../../eval/safety_mapping.json" with { type: "json" };
import { safetyInputSchema, safetyOutputSchema } from "../schemas/safety.ts";
import { SAFETY_SYSTEM } from "../prompts/prompt-safety.ts";
import {
  prepareJsonRequest,
  executeJson,
  type JsonTransport,
} from "./json-model.ts";
import { moderationSignalSchema, type ModerationSignal } from "./moderation.ts";
import type { PrepareJudgeOptions } from "./judge.ts";
export function mapSafety(raw: unknown) {
  const parsed = safetyOutputSchema.safeParse(raw);
  if (!parsed.success) throw new Error("SAFETY_OUTPUT_INVALID");
  const { label, category } = parsed.data;
  const routes: Record<
    string,
    Record<string, string>
  > = mapping.classification_to_behavior;
  const behavior = routes[label]?.[category];
  if (behavior !== "CONTINUE" && behavior !== "HANDOFF" && behavior !== "STOP")
    throw new Error("SAFETY_MAPPING_INVALID");
  return {
    ...parsed.data,
    behavior,
    contact: structuredClone(mapping.category_to_contact[category]),
  };
}
/** Classifier stage only: caller must also apply the Moderation contract before public use. */
export async function executeSafety(
  raw: unknown,
  options: PrepareJudgeOptions,
  transport: JsonTransport,
  moderation?: ModerationSignal,
) {
  const parsed = safetyInputSchema.safeParse(raw);
  if (!parsed.success) throw new Error("SAFETY_INPUT_INVALID");
  const signal =
    moderation === undefined
      ? undefined
      : moderationSignalSchema.parse(moderation);
  return executeJson(
    prepareJsonRequest(
      SAFETY_SYSTEM,
      { ...parsed.data, ...(signal ? { moderation: signal } : {}) },
      options,
    ),
    mapSafety,
    transport,
    "SAFETY",
  );
}
