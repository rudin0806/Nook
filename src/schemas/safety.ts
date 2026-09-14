import { z } from "zod";
import { rawThoughtSchema } from "./start.ts";
export const safetyInputSchema = z
  .strictObject({
    context: z.array(rawThoughtSchema).max(20),
    utterance: rawThoughtSchema,
  })
  .refine((v) => v.context.join("").length + v.utterance.length <= 20_000);
export const safetyOutputSchema = z
  .strictObject({
    label: z.enum(["NONE", "AMBIGUOUS", "HIGH_RISK"]),
    category: z.enum([
      "NONE",
      "SUICIDE_SELF_HARM",
      "YOUTH",
      "VIOLENCE_VICTIM",
      "GENERAL_MENTAL_HEALTH",
    ]),
  })
  .refine((v) => v.label === "NONE" || v.category !== "NONE");
export type SafetyOutput = z.infer<typeof safetyOutputSchema>;
