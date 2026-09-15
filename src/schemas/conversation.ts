import { z } from "zod";
import { judgeInputSchema, judgeOutputSchema } from "./judge.ts";
import { questionTypeSchema } from "./reflect.ts";
export const conversationRequestSchema = z
  .strictObject({
    requestId: z.uuid(),
    nodeId: z.uuid(),
    version: z.number().int().nonnegative(),
    action: z.enum(["reply", "approve", "reject", "finish", "continue"]),
    text: z.string().trim().min(1).max(1000).optional(),
  })
  .superRefine((v, c) => {
    if (["reply", "approve"].includes(v.action) !== Boolean(v.text))
      c.addIssue({ code: "custom", message: "Invalid action text" });
  });
export type ConversationRequest = z.infer<typeof conversationRequestSchema>;
const node = z.object({
  id: z.uuid(),
  segment_id: z.uuid(),
  ordinal: z.number().int(),
  final_text: z.string().min(1).max(1000),
});
export const conversationStateSchema = z.object({
  dismissed_closure: z.string().max(5000).nullable().default(null),
  version: z.number().int().nonnegative(),
  mode: z.enum([
    "READY",
    "SHIFT",
    "CLOSE",
    "STRUCTURAL",
    "FINISHED",
    "STOP",
    "HANDOFF",
  ]),
  pending: z
    .object({
      question: z.string().min(1).max(1000),
      evidence_sentence: z.string().min(1).max(1000),
      evidence_ids: z.array(z.uuid()).min(1).max(10),
      promoted_branch_id: z.uuid().nullable(),
      one_turn_shift: z.boolean(),
    })
    .nullable(),
  last_question_type: questionTypeSchema.nullable(),
  carryover: judgeInputSchema.shape.carryover,
});
export const conversationSnapshotSchema = z.object({
  session: z.object({
    id: z.uuid(),
    status: z.enum(["ACTIVE", "COMPLETED"]),
    storage_state: z.enum(["TEMPORARY", "SAVED", "TRASHED"]),
    past_probe_count: z.number().int().min(0).max(1),
  }),
  segment: z.object({
    id: z.uuid(),
    ordinal: z.number().int().positive(),
    node_count: z.number().int().min(0).max(4),
    turn_count: z.number().int().min(0).max(20),
    branch_count: z.number().int().min(0).max(5),
    anchor_node_id: z.uuid().nullable(),
  }),
  current: node,
  path: z.array(node).min(1).max(8),
  messages: z
    .array(
      z.object({
        id: z.uuid(),
        role: z.enum(["USER", "ASSISTANT"]),
        content: z.string().min(1).max(5000),
        sequence_no: z.number().int().positive(),
        segment_id: z.uuid(),
      }),
    )
    .min(1)
    .max(200),
  clarifications: z
    .array(
      z.object({
        id: z.uuid(),
        text: z.string().min(1).max(1000),
        node_id: z.uuid(),
      }),
    )
    .max(64),
  pile: z
    .array(
      z.object({
        id: z.uuid(),
        text: z.string().min(1).max(1000),
        source_session_id: z.uuid().nullable(),
        retention_state: z.enum(["PENDING", "KEPT"]),
      }),
    )
    .max(50),
  state: conversationStateSchema,
});
export type ConversationSnapshot = z.infer<typeof conversationSnapshotSchema>;
export const conversationPlanSchema = z.object({
  kind: z.enum(["REFLECT", "SHIFT", "CLOSE", "STRUCTURAL", "FINISH"]),
  question: z.string().max(1000).optional(),
  type: questionTypeSchema.optional(),
  evidence_sentence: z.string().max(1000).optional(),
  evidence_ids: z.array(z.uuid()).max(10).default([]),
  promoted_branch_id: z.uuid().nullable().default(null),
  one_turn_shift: z.boolean().default(false),
  judge: judgeOutputSchema.nullable(),
  metadata: z
    .object({
      configuredModel: z.string(),
      promptVersion: z.string(),
      latencyMs: z.number().int().nonnegative(),
      inputTokens: z.number().int().nullable(),
      outputTokens: z.number().int().nullable(),
    })
    .nullable(),
  turnIds: z.record(z.string(), z.uuid()),
  carryover: judgeInputSchema.shape.carryover,
});
export type ConversationPlan = z.infer<typeof conversationPlanSchema>;
export const conversationViewSchema = z.object({
  sessionId: z.uuid(),
  version: z.number().int().nonnegative(),
  mode: conversationStateSchema.shape.mode,
  currentQuestion: z.string(),
  pending: z
    .object({ question: z.string(), evidence_sentence: z.string() })
    .nullable(),
  messages: z.array(
    z.object({
      id: z.uuid(),
      role: z.enum(["USER", "ASSISTANT"]),
      content: z.string(),
    }),
  ),
  clarifications: z.array(z.object({ id: z.uuid(), text: z.string() })),
  branches: z.array(z.object({ id: z.uuid(), text: z.string() })),
  contact: z
    .object({ primary: z.string(), urgent: z.string().optional() })
    .nullable()
    .optional(),
});
export type ConversationView = z.infer<typeof conversationViewSchema>;
