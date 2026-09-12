import { z } from "zod";
export const mediumReasonSchema = z.enum([
  "SINGLE_SPONTANEOUS",
  "ALL_HEDGED",
  "AI_LED_WITH_USER_MATERIAL",
]);
const evidence = z
  .array(z.string().regex(/^U\d+$/))
  .refine((ids) => new Set(ids).size === ids.length, "Duplicate evidence");
export const judgeOutputSchema = z
  .strictObject({
    action: z.enum(["SHIFT", "REFLECT", "CLOSE"]),
    shift_confidence: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
    medium_reason: mediumReasonSchema.nullable(),
    evidence_turns: evidence,
    clarifications: z.array(
      z.strictObject({
        text: z.string().min(1),
        confidence: z.enum(["HIGH", "MEDIUM"]),
        evidence_turns: evidence.min(1),
      }),
    ),
    branches: z.array(
      z.strictObject({
        text: z.string().min(1),
        evidence_turns: evidence.min(1),
      }),
    ),
    invalidate_clarifications: z
      .array(z.string())
      .refine((ids) => new Set(ids).size === ids.length),
    promote_pile_item: z.string().min(1).nullable(),
  })
  .superRefine((o, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: "custom", message });
    if (
      o.action === "CLOSE"
        ? Object.hasOwn(o, "shift_confidence")
        : o.action === "SHIFT"
          ? o.shift_confidence !== "HIGH"
          : !["MEDIUM", "LOW"].includes(o.shift_confidence ?? "")
    )
      fail("Invalid action/confidence");
    if (
      (o.action === "REFLECT" && o.shift_confidence === "MEDIUM") !==
      (o.medium_reason !== null)
    )
      fail("Invalid medium_reason");
    if (o.promote_pile_item !== null && o.action !== "SHIFT")
      fail("Promotion requires SHIFT/HIGH");
    if (
      (o.action === "SHIFT" || o.shift_confidence === "MEDIUM") &&
      !o.evidence_turns.length
    )
      fail("Evidence required");
  });
export type JudgeOutput = z.infer<typeof judgeOutputSchema>;
