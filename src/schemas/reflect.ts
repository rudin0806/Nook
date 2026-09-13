import { z } from "zod";
import { mediumReasonSchema } from "./judge.ts";
export type MediumReason = z.infer<typeof mediumReasonSchema>;
export const questionTypeSchema = z.enum(["PRESENT", "PAST", "COMPARE"]);
export const reflectOutputSchema = z.strictObject({
  question: z.string().trim().min(1),
  type: questionTypeSchema,
});
export const reflectContextSchema = z.strictObject({
  main_question: z.string().trim().min(1),
  past_probe_count: z.union([z.literal(0), z.literal(1)]),
  last_question_type: questionTypeSchema.nullable(),
  current_clarifications: z.array(
    z.strictObject({ id: z.string(), text: z.string().min(1) }),
  ),
  turns: z
    .array(
      z.strictObject({
        id: z.string(),
        role: z.enum(["user", "assistant"]),
        text: z.string().min(1),
      }),
    )
    .min(1),
  carryover: z
    .array(
      z.strictObject({
        turn: z.string().regex(/^U\d+$/),
        text: z.string().min(1),
      }),
    )
    .max(2),
});
export type ReflectContext = z.infer<typeof reflectContextSchema>;
