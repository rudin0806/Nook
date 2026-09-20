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
  // 보관과 휴지통은 질문을 함께 읽어야 한다. 두 테이블 모두 시각만 담고 있어서, 홈은
  // 책마다 story 전문을 따로 받아 제목을 꺼냈고(책 4권이면 요청 5번) 생각 더미는
  // 날짜를 제목으로 썼다. RPC가 마지막 중심 질문을 붙이고 정산도 안에서 한다.
  async function withQuestion(name: string) {
    const { data, error } = await supabase.rpc(name, {
      p_limit: query.limit,
      p_offset: query.offset,
    });
    if (error) throw new RetentionDatabaseError(error.message);
    return data ?? [];
  }
  if (query.collection === "saved") {
    const rows = await withQuestion("list_saved_sessions");
    return page(savedSessionListItemSchema.array().parse(rows), query);
  }
  if (query.collection === "trash") {
    const rows = await withQuestion("list_trashed_sessions");
    return page(trashedSessionListItemSchema.array().parse(rows), query);
  }

  const settled = await supabase.rpc("settle_own_retention");
  if (settled.error) throw new RetentionDatabaseError(settled.error.message);
  const config = sessionCollections[query.collection as "active"];
  const { data, error } = await supabase
    .from(config.table)
    .select(config.columns)
    .order(config.order, { ascending: false })
    .range(query.offset, query.offset + query.limit);
  if (error) throw new RetentionDatabaseError(error.message);
  return page(activeSessionListItemSchema.array().parse(data ?? []), query);
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

/** 이어갈 대화를 지금 휴지통으로 보낸다. 24시간 뒤 만료가 하던 전환을 당기는
 *  것이라 상태는 그것과 같고, 계정이 없는 사용자에게는 만료와 마찬가지로 지운다. */
export async function discardActiveSession(
  supabase: SupabaseClient,
  sessionId: string,
) {
  const { data, error } = await supabase.rpc("discard_active_session", {
    target_session_id: sessionId,
  });
  if (error) throw new RetentionDatabaseError(error.message);
  return z
    .object({
      sessionId: z.uuid(),
      state: z.enum(["trashed", "deleted"]),
    })
    .parse(data);
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

export async function moveSavedSession(
  supabase: SupabaseClient,
  sessionId: string,
  input: SavedSessionPositionInput,
) {
  const { data, error } = await supabase.rpc("move_saved_session_checked", {
    p_session_id: sessionId,
    p_target_position: input.position,
    p_expected_revision: input.expectedRevision,
  });
  if (error) throw new RetentionDatabaseError(error.message);
  return {
    sessionId,
    ...z
      .object({
        position: z.number().int().positive(),
        revision: z.string().regex(/^[a-f0-9]{32}$/),
      })
      .parse(data),
  };
}
