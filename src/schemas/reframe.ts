import { z } from "zod";

export const reframeOutputSchema = z.strictObject({
  question: z
    .string()
    .trim()
    .min(2)
    .max(1_000)
    .refine(
      (value) =>
        !/[\r\n]/u.test(value) &&
        (value.match(/[?？]/gu) ?? []).length === 1 &&
        /[?？]$/u.test(value),
      "One question ending in a question mark required",
    ),
  evidence_sentence: z
    .string()
    .trim()
    .min(1)
    .max(1_000)
    .refine(
      (value) => !/[\r\n?？]/u.test(value),
      "Declarative evidence line required",
    ),
});
export type ReframeOutput = z.infer<typeof reframeOutputSchema>;
