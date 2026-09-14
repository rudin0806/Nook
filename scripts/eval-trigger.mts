import { readFileSync } from "node:fs";
import { z } from "zod";
import {
  NOOK_MODEL_IDS,
  NOOK_REASONING_EFFORTS,
} from "../src/lib/openai/models.ts";

const triggerSchema = z
  .strictObject({
    requestedAt: z.iso.datetime({ offset: true }),
    model: z.enum(NOOK_MODEL_IDS),
    reasoningEffort: z.enum(NOOK_REASONING_EFFORTS),
    ids: z
      .array(z.string().regex(/^J-[a-zA-Z0-9-]+$/))
      .min(1)
      .max(32)
      .refine((ids) => new Set(ids).size === ids.length),
    maxCases: z.number().int().min(1).max(32),
    maxOutputTokens: z.number().int().min(256).max(4096),
  })
  .refine((trigger) => trigger.ids.length <= trigger.maxCases);

export type EvalTrigger = z.infer<typeof triggerSchema>;

export function parseEvalTrigger(raw: string): EvalTrigger {
  return triggerSchema.parse(JSON.parse(raw));
}

export function loadEvalTrigger(path: string): EvalTrigger {
  return parseEvalTrigger(readFileSync(path, "utf8"));
}
