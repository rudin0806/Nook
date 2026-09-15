import { z } from "zod";
import { savedSessionListItemSchema } from "./retention.ts";
export const storyQuerySchema = z.object({
  offset: z.coerce.number().int().min(0).max(10000).default(0),
});
export const storyNodeSchema = z.object({
  id: z.uuid(),
  segment_id: z.uuid(),
  ordinal: z.number().int().positive(),
  final_text: z.string().min(1),
  approved_at: z.iso.datetime({ offset: true }),
});
export const storyClarificationSchema = z.object({
  id: z.uuid(),
  node_id: z.uuid(),
  text: z.string().min(1),
});
export const savedStorySchema = z.object({
  session: savedSessionListItemSchema,
  initialThought: z.string().max(5000).nullable().optional(),
  segments: z.array(
    z.object({
      id: z.uuid(),
      ordinal: z.number().int().positive(),
      nodes: z.array(storyNodeSchema),
    }),
  ),
  clarifications: z.array(storyClarificationSchema),
  offset: z.number().int().nonnegative(),
  hasMore: z.boolean(),
});
export type SavedStory = z.infer<typeof savedStorySchema>;
