import { z } from "zod";
import { NOOK_MODEL_IDS, NOOK_REASONING_EFFORTS } from "../openai/models.ts";

export const judgeEnvironmentSchema = z.object({
  model: z.enum(NOOK_MODEL_IDS),
  reasoningEffort: z.enum(NOOK_REASONING_EFFORTS),
  maxOutputTokens: z.coerce.number().int().min(256).max(2_048),
});
