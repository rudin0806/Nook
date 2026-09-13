begin;

create or replace function public.finalize_session_retention(
  target_session_id uuid,
  keep_session boolean,
  kept_branch_ids uuid[] default '{}'::uuid[]
)
returns public.thought_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_is_anonymous boolean :=
    coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
  v_session public.thought_sessions;
  v_requested_count integer;
  v_valid_count integer;
  v_distinct_count integer;
begin
  if v_user_id is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  if keep_session is null then
    raise exception 'KEEP_SESSION_DECISION_REQUIRED';
  end if;

  kept_branch_ids := coalesce(kept_branch_ids, '{}'::uuid[]);

  select session_row.*
  into v_session
  from public.thought_sessions session_row
  where session_row.id = target_session_id
    and session_row.user_id = v_user_id
  for update;

  if v_session.id is null then
    raise exception 'SESSION_NOT_FOUND';
  end if;

  if v_session.status <> 'COMPLETED'
    or v_session.storage_state <> 'TEMPORARY' then
    raise exception 'SESSION_RETENTION_ALREADY_DECIDED';
  end if;

  if v_is_anonymous
    and (keep_session or cardinality(kept_branch_ids) > 0) then
    raise exception 'IDENTITY_LINK_REQUIRED';
  end if;

  select count(*), count(distinct branch_id)
  into v_requested_count, v_distinct_count
  from unnest(kept_branch_ids) as selected(branch_id);

  if v_requested_count <> v_distinct_count then
    raise exception 'DUPLICATE_BRANCH_SELECTION';
  end if;

  select count(*)
  into v_valid_count
  from public.branch_questions branch_row
  where branch_row.id = any(kept_branch_ids)
    and branch_row.user_id = v_user_id
    and branch_row.source_session_id = target_session_id
    and branch_row.retention_state = 'PENDING';

  if v_valid_count <> v_requested_count then
    raise exception 'INVALID_BRANCH_SELECTION';
  end if;

  update public.branch_questions
  set retention_state = 'KEPT',
      kept_at = now()
  where id = any(kept_branch_ids)
    and user_id = v_user_id
    and source_session_id = target_session_id
    and retention_state = 'PENDING';

  delete from public.branch_questions
  where user_id = v_user_id
    and source_session_id = target_session_id
    and retention_state = 'PENDING';

  if keep_session then
    update public.thought_sessions
    set storage_state = 'SAVED',
        retention_decided_at = now(),
        trashed_at = null,
        purge_after = null,
        temporary_expires_at = null
    where id = target_session_id
    returning * into v_session;
  elsif v_is_anonymous then
    delete from public.thought_sessions
    where id = target_session_id
      and user_id = v_user_id;

    return null;
  else
    update public.thought_sessions
    set storage_state = 'TRASHED',
        retention_decided_at = now(),
        trashed_at = now(),
        purge_after = now() + interval '7 days',
        temporary_expires_at = null
    where id = target_session_id
    returning * into v_session;
  end if;

  return v_session;
end;
$$;

comment on function public.finalize_session_retention(uuid, boolean, uuid[])
is 'Finalizes completed-session retention. Anonymous users must link an identity to keep any content; anonymous discard deletes immediately.';

-- Dashboard-created helper is optional on a fresh Supabase installation.
-- Replay-only compatibility fix: existing remote permissions stay unchanged.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke all privileges on function public.rls_auto_enable()
    from public, anon, authenticated;
  end if;
end;
$$;

drop policy if exists branch_questions_select_own_kept
on public.branch_questions;

create policy branch_questions_select_own_kept
on public.branch_questions
for select
to authenticated
using (
  user_id = (select auth.uid())
  and retention_state = 'KEPT'
);

drop policy if exists branch_question_evidence_select_own_kept
on public.branch_question_evidence;

create policy branch_question_evidence_select_own_kept
on public.branch_question_evidence
for select
to authenticated
using (
  exists (
    select 1
    from public.branch_questions branch_row
    where branch_row.id = branch_question_id
      and branch_row.user_id = (select auth.uid())
      and branch_row.retention_state = 'KEPT'
  )
);

drop policy if exists judge_logs_server_only
on public.judge_logs;

create policy judge_logs_server_only
on public.judge_logs
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists safety_events_server_only
on public.safety_events;

create policy safety_events_server_only
on public.safety_events
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

create index if not exists clarification_evidence_clarification_session_idx
  on public.clarification_evidence (clarification_id, session_id);

create index if not exists clarification_evidence_message_session_idx
  on public.clarification_evidence (message_id, session_id);

create index if not exists clarifications_node_session_idx
  on public.clarifications (node_id, session_id);

create index if not exists judge_logs_message_session_idx
  on public.judge_logs (user_message_id, session_id);

create index if not exists judge_logs_segment_session_idx
  on public.judge_logs (segment_id, session_id);

create index if not exists messages_segment_session_idx
  on public.messages (segment_id, session_id);

create index if not exists question_nodes_segment_session_idx
  on public.question_nodes (segment_id, session_id);

create index if not exists segments_anchor_node_session_idx
  on public.segments (anchor_node_id, session_id);

create index if not exists shift_edge_evidence_edge_session_idx
  on public.shift_edge_evidence (edge_id, session_id);

create index if not exists shift_edge_evidence_message_session_idx
  on public.shift_edge_evidence (message_id, session_id);

create index if not exists shift_edges_from_node_session_idx
  on public.shift_edges (from_node_id, session_id);

create index if not exists shift_edges_to_node_session_idx
  on public.shift_edges (to_node_id, session_id);

commit;
