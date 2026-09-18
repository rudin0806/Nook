import { z } from "zod";

const judgeTextSchema = z.string().trim().min(1).max(5_000);
const judgeReferenceIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);

export const mediumReasonSchema = z.enum([
  "SINGLE_SPONTANEOUS",
  "ALL_HEDGED",
  "AI_LED_WITH_USER_MATERIAL",
]);

export const judgeTurnSchema = z
  .strictObject({
    id: z.string().regex(/^[UA]\d+$/),
    role: z.enum(["user", "assistant"]),
    text: judgeTextSchema,
  })
  .superRefine((turn, ctx) => {
    const expectedPrefix = turn.role === "user" ? "U" : "A";
    if (!turn.id.startsWith(expectedPrefix))
      ctx.addIssue({ code: "custom", message: "Turn role/id mismatch" });
  });

export const judgeInputSchema = z
  .strictObject({
    dismissed_closure: judgeTextSchema.nullable().optional(),
    main_question: judgeTextSchema.max(1_000),
    main_path: z.array(judgeTextSchema.max(1_000)).min(1).max(8),
    pile: z
      .array(
        z.strictObject({
          id: judgeReferenceIdSchema,
          text: judgeTextSchema.max(1_000),
        }),
      )
      .max(50),
    current_clarifications: z
      .array(
        z.strictObject({
          id: judgeReferenceIdSchema,
          text: judgeTextSchema.max(1_000),
          confidence: z.enum(["HIGH", "MEDIUM"]).optional(),
          evidence_turns: z.array(z.string().regex(/^U\d+$/)).optional(),
        }),
      )
      .max(16),
    carryover: z
      .array(
        z.strictObject({
          turn: z.string().regex(/^U\d+$/),
          text: judgeTextSchema,
          judged: z.literal("MEDIUM"),
          medium_reason: mediumReasonSchema,
        }),
      )
      .max(2),
    /** 코드가 센 값(RULES 8.1). 사용자의 상태가 아니라 답의 길이만 본다. */
    stalled: z.boolean().optional(),
    turns: z.array(judgeTurnSchema).min(1).max(8),
  })
  .superRefine((input, ctx) => {
    const unique = (values: string[], message: string) => {
      if (new Set(values).size !== values.length)
        ctx.addIssue({ code: "custom", message });
    };
    unique(
      input.turns.map((turn) => turn.id),
      "Duplicate turn id",
    );
    unique(
      input.pile.map((item) => item.id),
      "Duplicate pile id",
    );
    unique(
      input.current_clarifications.map((item) => item.id),
      "Duplicate clarification id",
    );
    unique(
      input.carryover.map((item) => item.turn),
      "Duplicate carryover turn",
    );
    if (input.turns.at(-1)?.role !== "user")
      ctx.addIssue({ code: "custom", message: "Latest turn must be user" });
  });

export type JudgeInput = z.infer<typeof judgeInputSchema>;
export type JudgeTurn = z.infer<typeof judgeTurnSchema>;

const evidence = z
  .array(z.string().regex(/^U\d+$/))
  .max(10)
  .refine((ids) => new Set(ids).size === ids.length, "Duplicate evidence");
export const judgeOutputSchema = z
  .strictObject({
    action: z.enum(["SHIFT", "REFLECT", "CLOSE"]),
    shift_confidence: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
    medium_reason: mediumReasonSchema.nullable(),
    evidence_turns: evidence,
    clarifications: z
      .array(
        z.strictObject({
          text: z.string().trim().min(1).max(1_000),
          confidence: z.enum(["HIGH", "MEDIUM"]),
          evidence_turns: evidence.min(1),
        }),
      )
      .max(3),
    branches: z
      .array(
        z.strictObject({
          text: z.string().trim().min(1).max(1_000),
          evidence_turns: evidence.min(1),
        }),
      )
      .max(5),
    invalidate_clarifications: z
      .array(judgeReferenceIdSchema)
      .max(16)
      .refine((ids) => new Set(ids).size === ids.length),
    promote_pile_item: judgeReferenceIdSchema.nullable(),
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
