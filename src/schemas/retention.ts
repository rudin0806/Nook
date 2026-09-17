import { z } from "zod";

export const sessionIdSchema = z.uuid();
export const branchQuestionIdSchema = z.uuid();

export const finalizeRetentionSchema = z
  .object({
    keepSession: z.boolean(),
    keptBranchIds: z
      .array(branchQuestionIdSchema)
      .max(50)
      .refine((ids) => new Set(ids).size === ids.length, {
        message: "같은 질문을 한 번만 선택해 주세요.",
      })
      .default([]),
  })
  .strict();

export const retentionCollectionSchema = z.enum(["active", "saved", "trash"]);

export const retentionListQuerySchema = z.object({
  collection: retentionCollectionSchema.default("saved"),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

const nullableId = z.uuid().nullable();
const timestamp = z.iso.datetime({ offset: true });

export const activeSessionListItemSchema = z.object({
  id: z.uuid(),
  origin_branch_id: nullableId,
  started_at: timestamp,
  last_activity_at: timestamp,
  temporary_expires_at: timestamp,
});

export const savedSessionListItemSchema = z.object({
  id: z.uuid(),
  origin_branch_id: nullableId,
  started_at: timestamp,
  completed_at: timestamp,
  retention_decided_at: timestamp,
  shelf_position: z.number().int().positive().nullable(),
  shelf_revision: z.string().regex(/^[a-f0-9]{32}$/),
  /** How much the conversation holds, so a book can be sized by it. */
  turn_count: z.number().int().nonnegative(),
  node_count: z.number().int().nonnegative(),
});

export const savedSessionPositionSchema = z
  .object({
    position: z.coerce.number().int().min(1).max(10_000),
    expectedRevision: z.string().regex(/^[a-f0-9]{32}$/),
  })
  .strict();

export const trashedSessionListItemSchema = z.object({
  id: z.uuid(),
  origin_branch_id: nullableId,
  started_at: timestamp,
  completed_at: timestamp,
  trashed_at: timestamp,
  purge_after: timestamp,
});

export const keptBranchQuestionListItemSchema = z.object({
  id: z.uuid(),
  source_session_id: nullableId,
  source_segment_id: nullableId,
  source_node_id: nullableId,
  text: z.string().min(1),
  kept_at: timestamp,
  created_at: timestamp,
});

export type FinalizeRetentionInput = z.infer<typeof finalizeRetentionSchema>;
export type RetentionCollection = z.infer<typeof retentionCollectionSchema>;
export type RetentionListQuery = z.infer<typeof retentionListQuerySchema>;
export type SavedSessionPositionInput = z.infer<
  typeof savedSessionPositionSchema
>;
