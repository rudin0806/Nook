import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  savedSessionListItemSchema,
  sessionIdSchema,
} from "../../schemas/retention.ts";
import {
  savedStorySchema,
  storyQuerySchema,
  storyNodeSchema,
  storyClarificationSchema,
  storyMessageSchema,
} from "../../schemas/saved-story.ts";

// The caller must provide its cookie-authenticated client, never a service-role client.
export async function readSavedStory(
  client: SupabaseClient,
  candidate: string,
  rawQuery: unknown,
) {
  const id = sessionIdSchema.parse(candidate);
  const { offset } = storyQuerySchema.parse(rawQuery);
  const parent = () =>
    client
      .from("saved_thought_sessions")
      .select(
        "id,origin_branch_id,started_at,completed_at,retention_decided_at,shelf_position,shelf_revision,turn_count,node_count",
      )
      .eq("id", id)
      .maybeSingle();
  const initial = await parent();
  if (initial.error) throw new Error("STORY_QUERY_FAILED");
  if (!initial.data) return null;
  const session = savedSessionListItemSchema.parse(initial.data);
  const segmentResult = await client
    .from("segments")
    .select("id,ordinal")
    .eq("session_id", id)
    .order("ordinal", { ascending: true })
    .range(offset, offset + 10);
  if (segmentResult.error) throw new Error("STORY_QUERY_FAILED");
  const segmentRows = z
    .array(z.object({ id: z.uuid(), ordinal: z.number().int().positive() }))
    .max(11)
    .parse(segmentResult.data);
  const segments = segmentRows.slice(0, 10);
  let nodes: z.infer<typeof storyNodeSchema>[] = [];
  let clarifications: z.infer<typeof storyClarificationSchema>[] = [];
  let messages: z.infer<typeof storyMessageSchema>[] = [];
  if (segments.length) {
    // 나눈 말 그대로가 상세 화면의 본문이다. 요약만 돌려주던 동안에는 "이런 대화를
    // 나눴었지"를 확인할 길이 어디에도 없었다. RLS를 그대로 통과하는 쿠키
    // 클라이언트로 읽고, 이 페이지의 구간에 속한 것만 가져온다.
    const messageResult = await client
      .from("messages")
      .select("id,role,content,kind,sequence_no,segment_id,created_at")
      .eq("session_id", id)
      .in(
        "segment_id",
        segments.map((s) => s.id),
      )
      .order("sequence_no", { ascending: true })
      .limit(200);
    if (messageResult.error) throw new Error("STORY_QUERY_FAILED");
    messages = storyMessageSchema.array().max(200).parse(messageResult.data);
    const result = await client
      .from("question_nodes")
      .select("id,segment_id,ordinal,ai_proposed_text,final_text,approved_at")
      .eq("session_id", id)
      .in(
        "segment_id",
        segments.map((s) => s.id),
      )
      .order("ordinal", { ascending: true })
      .limit(41);
    if (result.error) throw new Error("STORY_QUERY_FAILED");
    // 제안 원문으로 노드가 생긴 발화를 맞추되, 그 원문 자체는 응답에 담지 않는다.
    // 구간의 첫 노드는 그 구간의 첫 발화에서, 이후 노드는 그 문장을 제안한 발화에서
    // 생긴다 — 대화 화면(`conversationView`)과 같은 규칙이다.
    const rows = z
      .array(
        z.object({
          id: z.uuid(),
          segment_id: z.uuid(),
          ordinal: z.number().int().positive(),
          ai_proposed_text: z.string().nullable(),
          final_text: z.string().min(1),
          approved_at: z.iso.datetime({ offset: true }),
        }),
      )
      .max(40)
      .parse(result.data);
    nodes = storyNodeSchema
      .array()
      .max(40)
      .parse(
        rows.map(({ ai_proposed_text, ...node }) => {
          const inSegment = messages.filter(
            (message) => message.segment_id === node.segment_id,
          );
          const birth =
            node.ordinal === 1
              ? inSegment[0]
              : inSegment
                  .filter(
                    (message) =>
                      message.kind === "SHIFT_PROPOSAL" &&
                      message.content === ai_proposed_text &&
                      Date.parse(message.created_at) <=
                        Date.parse(node.approved_at),
                  )
                  .at(-1);
          return { ...node, birth_message_id: birth?.id ?? null };
        }),
      );
    if (nodes.length) {
      const result = await client
        .from("clarifications")
        .select("id,node_id,text")
        .eq("session_id", id)
        .eq("status", "ACTIVE")
        .in(
          "node_id",
          nodes.map((n) => n.id),
        )
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .limit(201);
      if (result.error) throw new Error("STORY_QUERY_FAILED");
      clarifications = storyClarificationSchema
        .array()
        .max(200)
        .parse(result.data);
    }
  }
  let initialThought: string | null = null;
  if (offset === 0 && !nodes.length) {
    const raw = await client
      .from("messages")
      .select("content")
      .eq("session_id", id)
      .eq("kind", "RAW_THOUGHT")
      .eq("role", "USER")
      .maybeSingle();
    if (raw.error) throw new Error("STORY_QUERY_FAILED");
    initialThought = z
      .string()
      .max(5000)
      .nullable()
      .parse(raw.data?.content ?? null);
  }
  // A concurrent move to trash must not leave the detail response presented as saved.
  const latest = await parent();
  if (latest.error) throw new Error("STORY_QUERY_FAILED");
  if (!latest.data) return null;
  return savedStorySchema.parse({
    session,
    initialThought,
    segments: segments.map((s) => ({
      ...s,
      nodes: nodes.filter((n) => n.segment_id === s.id),
    })),
    clarifications,
    messages,
    offset,
    hasMore: segmentRows.length > 10,
  });
}
