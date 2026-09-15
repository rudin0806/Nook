import { z } from "zod";
import { nodeZeroOutputSchema } from "./start.ts";
export const restartSourceSchema = z.strictObject({
  kind: z.enum(["node", "branch", "session"]),
  id: z.uuid(),
});
export const restartSourceViewSchema = z.object({
  question: z.string().min(1).max(5000),
  sourceSessionId: z.uuid().nullable(),
});
export const storedStartResultSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("PROPOSAL"), proposal: nodeZeroOutputSchema }),
  z.object({
    kind: z.literal("CLEAR_AS_IS"),
    question: z.string().min(1).max(5000),
  }),
  z.object({
    kind: z.literal("FOCUS_REQUIRED"),
    question: z.string().min(1).max(1000),
    candidates: z.array(z.string().min(1).max(500)).min(2).max(10),
  }),
  z.object({
    kind: z.literal("NEEDS_INFO"),
    guidance: z.string().min(1).max(1000),
  }),
]);
export const recoveryItemSchema = z.object({
  id: z.uuid(),
  status: z.enum(["ACTIVE", "COMPLETED"]),
  expiresAt: z.iso.datetime({ offset: true }),
  nodeId: z.uuid().nullable(),
  question: z.string().max(160),
});
export const recoveryPageSchema = z.object({
  items: z.array(recoveryItemSchema).max(50),
  hasMore: z.boolean(),
});
export type RecoveryItem = z.infer<typeof recoveryItemSchema>;
