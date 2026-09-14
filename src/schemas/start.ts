import { z } from "zod";
import { reframeOutputSchema } from "./reframe.ts";

export const rawThoughtSchema = z.string().trim().min(1).max(5_000);
export const startInputSchema = z.strictObject({
  raw_thought: rawThoughtSchema,
});
export const startOutputSchema = z
  .strictObject({
    label: z.enum(["NEEDS_INFO", "CLEAR_AS_IS", "REFRAME_NEEDED"]),
    focus_required: z.boolean(),
    focus_question: reframeOutputSchema.shape.question.nullable(),
    focus_candidates: z.array(z.string().trim().min(1).max(500)).max(10),
    info_guidance: z.string().trim().min(1).max(1_000).nullable(),
  })
  .superRefine((v, ctx) => {
    const invalid = v.focus_required
      ? v.label !== "REFRAME_NEEDED" ||
        v.focus_question === null ||
        v.focus_candidates.length < 2 ||
        new Set(v.focus_candidates).size !== v.focus_candidates.length
      : v.focus_question !== null || v.focus_candidates.length !== 0;
    if (invalid || (v.label === "NEEDS_INFO") !== (v.info_guidance !== null))
      ctx.addIssue({ code: "custom", message: "Inconsistent start fields" });
  });
export const nodeZeroInputSchema = z
  .strictObject({
    raw_thought: rawThoughtSchema,
    selected_focus: z.string().trim().min(1).max(500).nullable(),
    focus_reply: rawThoughtSchema.nullable(),
  })
  .refine((v) => (v.selected_focus === null) === (v.focus_reply === null));
export const nodeZeroOutputSchema = reframeOutputSchema.extend({
  evidence_quotes: z.array(z.string().trim().min(1).max(1_000)).min(1).max(8),
});
export type StartOutput = z.infer<typeof startOutputSchema>;
export type NodeZeroOutput = z.infer<typeof nodeZeroOutputSchema>;
