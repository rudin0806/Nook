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
        "id,origin_branch_id,started_at,completed_at,retention_decided_at,shelf_position,shelf_revision",
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
  if (segments.length) {
    const result = await client
      .from("question_nodes")
      .select("id,segment_id,ordinal,final_text,approved_at")
      .eq("session_id", id)
      .in(
        "segment_id",
        segments.map((s) => s.id),
      )
      .order("ordinal", { ascending: true })
      .limit(41);
    if (result.error) throw new Error("STORY_QUERY_FAILED");
    nodes = storyNodeSchema.array().max(40).parse(result.data);
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
    offset,
    hasMore: segmentRows.length > 10,
  });
}
