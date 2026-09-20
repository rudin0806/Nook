import { z } from "zod";
import { savedSessionListItemSchema } from "./retention.ts";
export const storyQuerySchema = z.object({
  offset: z.coerce.number().int().min(0).max(10000).default(0),
});
export const storyNodeSchema = z.object({
  id: z.uuid(),
  segment_id: z.uuid(),
  ordinal: z.number().int().positive(),
  /** 이 노드가 생긴 발화. 서버가 맞춰서 id만 내려보낸다 — 제안 원문(`ai_proposed_text`)은
   *  사용자가 확정한 문장이 아니므로 화면으로 내보내지 않는다. */
  birth_message_id: z.uuid().nullable().default(null),
  final_text: z.string().min(1),
  approved_at: z.iso.datetime({ offset: true }),
});
export const storyClarificationSchema = z.object({
  id: z.uuid(),
  node_id: z.uuid(),
  text: z.string().min(1),
});
/** 보관된 대화의 발화. 상세 화면이 "이런 대화를 나눴었지"를 그대로 보여 주기 위한
 *  것이므로 대화 화면과 같은 모양을 쓴다. */
export const storyMessageSchema = z.object({
  id: z.uuid(),
  role: z.enum(["USER", "ASSISTANT"]),
  content: z.string().min(1).max(5000),
  /** 노드가 어느 발화에서 생겼는지 찾는 데 쓴다. 대화 화면과 같은 규칙이다. */
  kind: z.enum([
    "RAW_THOUGHT",
    "USER_REPLY",
    "START_REFRAME",
    "REFLECTION",
    "SHIFT_PROPOSAL",
    "CLOSURE",
    "SYSTEM_NOTICE",
  ]),
  sequence_no: z.number().int().positive(),
  segment_id: z.uuid(),
  created_at: z.iso.datetime({ offset: true }),
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
  /** 이 페이지의 구간에서 오간 발화. 요약이 아니라 나눈 말 그대로다. */
  messages: z.array(storyMessageSchema).max(200).default([]),
  offset: z.number().int().nonnegative(),
  hasMore: z.boolean(),
});
export type SavedStory = z.infer<typeof savedStorySchema>;
