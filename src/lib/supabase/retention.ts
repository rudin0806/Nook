import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  activeSessionListItemSchema,
  keptBranchQuestionListItemSchema,
  savedSessionListItemSchema,
  trashedSessionListItemSchema,
  type FinalizeRetentionInput,
  type RetentionListQuery,
  type SavedSessionOrderInput,
  type SavedSessionPositionInput,
} from "@/schemas/retention";

type Page<T> = {
  items: T[];
  limit: number;
  offset: number;
  hasMore: boolean;
};

const sessionCollections = {
  active: {
    table: "active_thought_sessions",
    columns:
      "id,origin_branch_id,started_at,last_activity_at,temporary_expires_at",
    order: "last_activity_at",
  },
  saved: {
    table: "saved_thought_sessions",
    columns:
      "id,origin_branch_id,started_at,completed_at,retention_decided_at,shelf_position",
    order: "retention_decided_at",
  },
  trash: {
    table: "trashed_thought_sessions",
    columns:
      "id,origin_branch_id,started_at,completed_at,trashed_at,purge_after",
    order: "trashed_at",
  },
} as const;

export class RetentionDatabaseError extends Error {}

function page<T>(items: T[], query: RetentionListQuery): Page<T> {
  return {
    items: items.slice(0, query.limit),
    limit: query.limit,
    offset: query.offset,
    hasMore: items.length > query.limit,
  };
}

export async function listSessions(
  supabase: SupabaseClient,
  query: RetentionListQuery,
) {
  const settled = await supabase.rpc("settle_own_retention");
  if (settled.error) throw new RetentionDatabaseError(settled.error.message);
  const config = sessionCollections[query.collection];
  let request = supabase.from(config.table).select(config.columns);
  if (query.collection === "saved") {
    request = request
      .order("shelf_position", { ascending: true, nullsFirst: false })
      .order("retention_decided_at", { ascending: false });
  } else {
    request = request.order(config.order, { ascending: false });
  }
  const { data, error } = await request.range(
    query.offset,
    query.offset + query.limit,
  );

  if (error) throw new RetentionDatabaseError(error.message);
  if (query.collection === "active") {
    return page(activeSessionListItemSchema.array().parse(data ?? []), query);
  }
  if (query.collection === "saved") {
    return page(savedSessionListItemSchema.array().parse(data ?? []), query);
  }
  return page(trashedSessionListItemSchema.array().parse(data ?? []), query);
}

export async function listKeptBranchQuestions(
  supabase: SupabaseClient,
  query: Pick<RetentionListQuery, "limit" | "offset">,
) {
  const { data, error } = await supabase
    .from("kept_branch_questions")
    .select(
      "id,source_session_id,source_segment_id,source_node_id,text,kept_at,created_at",
    )
    .order("kept_at", { ascending: false })
    .range(query.offset, query.offset + query.limit);

  if (error) throw new RetentionDatabaseError(error.message);
  const items = keptBranchQuestionListItemSchema.array().parse(data ?? []);
  return page(items, { ...query, collection: "saved" });
}

export async function finalizeRetention(
  supabase: SupabaseClient,
  sessionId: string,
  input: FinalizeRetentionInput,
) {
  const { data, error } = await supabase.rpc("finalize_session_retention", {
    target_session_id: sessionId,
    keep_session: input.keepSession,
    kept_branch_ids: input.keptBranchIds,
  });

  if (error) throw new RetentionDatabaseError(error.message);

  return {
    sessionId,
    state: input.keepSession ? "saved" : data === null ? "deleted" : "trashed",
    keptBranchCount: input.keptBranchIds.length,
  } as const;
}

async function mutateSession(
  supabase: SupabaseClient,
  functionName: "move_session_to_trash" | "restore_session_from_trash",
  sessionId: string,
) {
  const { error } = await supabase.rpc(functionName, {
    target_session_id: sessionId,
  });
  if (error) throw new RetentionDatabaseError(error.message);
}

export async function moveSessionToTrash(
  supabase: SupabaseClient,
  sessionId: string,
) {
  await mutateSession(supabase, "move_session_to_trash", sessionId);
  return { sessionId, state: "trashed" as const };
}

export async function restoreSession(
  supabase: SupabaseClient,
  sessionId: string,
) {
  await mutateSession(supabase, "restore_session_from_trash", sessionId);
  return { sessionId, state: "saved" as const };
}

export async function deleteKeptBranchQuestion(
  supabase: SupabaseClient,
  branchQuestionId: string,
) {
  const { error } = await supabase.rpc("delete_kept_branch_question", {
    target_branch_id: branchQuestionId,
  });
  if (error) throw new RetentionDatabaseError(error.message);
}

export async function reorderSavedSessions(
  supabase: SupabaseClient,
  input: SavedSessionOrderInput,
) {
  const { error } = await supabase.rpc("reorder_saved_sessions", {
    p_session_ids: input.sessionIds,
  });
  if (error) throw new RetentionDatabaseError(error.message);
  return { sessionIds: input.sessionIds };
}

export async function moveSavedSession(
  supabase: SupabaseClient,
  sessionId: string,
  input: SavedSessionPositionInput,
) {
  const { data, error } = await supabase.rpc("move_saved_session", {
    p_session_id: sessionId,
    p_target_position: input.position,
  });
  if (error) throw new RetentionDatabaseError(error.message);
  return {
    sessionId,
    position: z.number().int().positive().parse(data),
  };
}
