begin;

create function public.can_view_session(target_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.thought_sessions session_row
    where session_row.id = target_session_id
      and session_row.user_id = auth.uid()
      and session_row.status in ('ACTIVE', 'COMPLETED')
  );
$$;

create function public.complete_thought_session(target_session_id uuid)
returns public.thought_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.thought_sessions;
begin
  if v_user_id is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  select session_row.*
  into v_session
  from public.thought_sessions session_row
  where session_row.id = target_session_id
    and session_row.user_id = v_user_id
  for update;

  if v_session.id is null then
    raise exception 'SESSION_NOT_FOUND';
  end if;

  if v_session.status <> 'ACTIVE'
    or v_session.storage_state <> 'TEMPORARY' then
    raise exception 'SESSION_NOT_COMPLETABLE';
  end if;

  update public.segments
  set status = 'CLOSED',
      closed_at = now()
  where session_id = target_session_id
    and status = 'ACTIVE';

  update public.thought_sessions
  set status = 'COMPLETED',
      completed_at = now(),
      last_activity_at = now(),
      temporary_expires_at = now() + interval '24 hours'
  where id = target_session_id
  returning * into v_session;

  return v_session;
end;
$$;

create function public.finalize_session_retention(
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

create function public.move_session_to_trash(target_session_id uuid)
returns public.thought_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.thought_sessions;
begin
  if v_user_id is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  update public.thought_sessions
  set storage_state = 'TRASHED',
      retention_decided_at = now(),
      trashed_at = now(),
      purge_after = now() + interval '7 days',
      temporary_expires_at = null
  where id = target_session_id
    and user_id = v_user_id
    and status = 'COMPLETED'
    and storage_state = 'SAVED'
  returning * into v_session;

  if v_session.id is null then
    raise exception 'SAVED_SESSION_NOT_FOUND';
  end if;

  return v_session;
end;
$$;

create function public.restore_session_from_trash(target_session_id uuid)
returns public.thought_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.thought_sessions;
begin
  if v_user_id is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  update public.thought_sessions
  set storage_state = 'SAVED',
      retention_decided_at = now(),
      trashed_at = null,
      purge_after = null,
      temporary_expires_at = null
  where id = target_session_id
    and user_id = v_user_id
    and status = 'COMPLETED'
    and storage_state = 'TRASHED'
    and purge_after > now()
  returning * into v_session;

  if v_session.id is null then
    raise exception 'RESTORABLE_SESSION_NOT_FOUND';
  end if;

  return v_session;
end;
$$;

create function public.delete_kept_branch_question(target_branch_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  delete from public.branch_questions
  where id = target_branch_id
    and user_id = v_user_id
    and retention_state = 'KEPT';

  if not found then
    raise exception 'KEPT_BRANCH_NOT_FOUND';
  end if;
end;
$$;

create function public.submit_session_feedback(
  target_session_id uuid,
  feedback public.feedback_answer
)
returns public.session_feedback
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_feedback public.session_feedback;
begin
  if v_user_id is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  if not exists (
    select 1
    from public.thought_sessions session_row
    where session_row.id = target_session_id
      and session_row.user_id = v_user_id
      and session_row.status = 'COMPLETED'
  ) then
    raise exception 'COMPLETED_SESSION_NOT_FOUND';
  end if;

  insert into public.session_feedback (session_id, answer)
  values (target_session_id, feedback)
  returning * into v_feedback;

  return v_feedback;
end;
$$;

create function public.open_next_segment(target_session_id uuid)
returns public.segments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_current_segment public.segments;
  v_anchor_node_id uuid;
  v_next_segment public.segments;
begin
  if v_user_id is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  if not exists (
    select 1
    from public.thought_sessions session_row
    where session_row.id = target_session_id
      and session_row.user_id = v_user_id
      and session_row.status = 'ACTIVE'
      and session_row.storage_state = 'TEMPORARY'
  ) then
    raise exception 'ACTIVE_SESSION_NOT_FOUND';
  end if;

  select segment_row.*
  into v_current_segment
  from public.segments segment_row
  where segment_row.session_id = target_session_id
    and segment_row.status = 'ACTIVE'
  for update;

  if v_current_segment.id is null then
    raise exception 'ACTIVE_SEGMENT_NOT_FOUND';
  end if;

  if v_current_segment.node_count < 4
    and v_current_segment.turn_count < 20
    and v_current_segment.branch_count < 5 then
    raise exception 'STRUCTURAL_LIMIT_NOT_REACHED';
  end if;

  select node_row.id
  into v_anchor_node_id
  from public.question_nodes node_row
  where node_row.segment_id = v_current_segment.id
  order by node_row.ordinal desc
  limit 1;

  if v_anchor_node_id is null then
    raise exception 'ANCHOR_NODE_NOT_FOUND';
  end if;

  update public.segments
  set status = 'CLOSED',
      closed_at = now()
  where id = v_current_segment.id;

  insert into public.segments (
    session_id,
    ordinal,
    status,
    anchor_node_id
  )
  values (
    target_session_id,
    v_current_segment.ordinal + 1,
    'ACTIVE',
    v_anchor_node_id
  )
  returning * into v_next_segment;

  return v_next_segment;
end;
$$;

create function public.consume_past_probe(target_session_id uuid)
returns smallint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_count smallint;
begin
  if v_user_id is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  update public.thought_sessions
  set past_probe_count = 1
  where id = target_session_id
    and user_id = v_user_id
    and status = 'ACTIVE'
    and storage_state = 'TEMPORARY'
    and past_probe_count = 0
  returning past_probe_count into v_count;

  if v_count is null then
    raise exception 'PAST_PROBE_ALREADY_USED_OR_SESSION_NOT_FOUND';
  end if;

  return v_count;
end;
$$;

create function public.record_safety_termination(
  target_session_id uuid,
  safety_result_label public.safety_label,
  safety_result_category public.safety_category,
  safety_result_behavior public.safety_behavior,
  detected_by public.safety_trigger_source
)
returns public.safety_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.safety_events;
  v_target_status public.session_status;
begin
  select case safety_result_behavior
    when 'STOP' then 'SAFETY_STOPPED'::public.session_status
    when 'HANDOFF' then 'HANDOFF_STOPPED'::public.session_status
  end
  into v_target_status;

  update public.segments
  set status = 'CLOSED',
      closed_at = now()
  where session_id = target_session_id
    and status = 'ACTIVE';

  update public.thought_sessions
  set status = v_target_status,
      completed_at = now(),
      last_activity_at = now(),
      temporary_expires_at = now() + interval '24 hours'
  where id = target_session_id
    and status = 'ACTIVE'
    and storage_state = 'TEMPORARY';

  if not found then
    raise exception 'ACTIVE_SESSION_NOT_FOUND';
  end if;

  insert into public.safety_events (
    session_id,
    label,
    category,
    behavior,
    trigger_source
  )
  values (
    target_session_id,
    safety_result_label,
    safety_result_category,
    safety_result_behavior,
    detected_by
  )
  returning * into v_event;

  return v_event;
end;
$$;

create function public.delete_pending_branches_before_session_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.branch_questions
  where source_session_id = old.id
    and retention_state = 'PENDING';

  return old;
end;
$$;

create trigger thought_sessions_delete_pending_branches
before delete on public.thought_sessions
for each row execute function public.delete_pending_branches_before_session_delete();

create function public.purge_expired_sessions()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted_count bigint;
begin
  delete from public.thought_sessions session_row
  where (
      session_row.storage_state = 'TRASHED'
      and session_row.purge_after <= now()
    )
    or (
      session_row.storage_state = 'TEMPORARY'
      and session_row.temporary_expires_at <= now()
    );

  get diagnostics v_deleted_count = row_count;
  return v_deleted_count;
end;
$$;

alter table public.thought_sessions enable row level security;
alter table public.segments enable row level security;
alter table public.messages enable row level security;
alter table public.question_nodes enable row level security;
alter table public.shift_edges enable row level security;
alter table public.shift_edge_evidence enable row level security;
alter table public.clarifications enable row level security;
alter table public.clarification_evidence enable row level security;
alter table public.branch_questions enable row level security;
alter table public.branch_question_evidence enable row level security;
alter table public.session_feedback enable row level security;
alter table public.judge_logs enable row level security;
alter table public.safety_events enable row level security;

create policy thought_sessions_select_own_visible
on public.thought_sessions
for select
to authenticated
using (public.can_view_session(id));

create policy segments_select_own_visible
on public.segments
for select
to authenticated
using (public.can_view_session(session_id));

create policy messages_select_own_visible
on public.messages
for select
to authenticated
using (public.can_view_session(session_id));

create policy question_nodes_select_own_visible
on public.question_nodes
for select
to authenticated
using (public.can_view_session(session_id));

create policy shift_edges_select_own_visible
on public.shift_edges
for select
to authenticated
using (public.can_view_session(session_id));

create policy shift_edge_evidence_select_own_visible
on public.shift_edge_evidence
for select
to authenticated
using (public.can_view_session(session_id));

create policy clarifications_select_own_visible
on public.clarifications
for select
to authenticated
using (public.can_view_session(session_id));

create policy clarification_evidence_select_own_visible
on public.clarification_evidence
for select
to authenticated
using (public.can_view_session(session_id));

create policy branch_questions_select_own_kept
on public.branch_questions
for select
to authenticated
using (
  user_id = auth.uid()
  and retention_state = 'KEPT'
);

create policy branch_question_evidence_select_own_kept
on public.branch_question_evidence
for select
to authenticated
using (
  exists (
    select 1
    from public.branch_questions branch_row
    where branch_row.id = branch_question_id
      and branch_row.user_id = auth.uid()
      and branch_row.retention_state = 'KEPT'
  )
);

create policy session_feedback_select_own_visible
on public.session_feedback
for select
to authenticated
using (public.can_view_session(session_id));

revoke all on table public.thought_sessions from anon, authenticated;
revoke all on table public.segments from anon, authenticated;
revoke all on table public.messages from anon, authenticated;
revoke all on table public.question_nodes from anon, authenticated;
revoke all on table public.shift_edges from anon, authenticated;
revoke all on table public.shift_edge_evidence from anon, authenticated;
revoke all on table public.clarifications from anon, authenticated;
revoke all on table public.clarification_evidence from anon, authenticated;
revoke all on table public.branch_questions from anon, authenticated;
revoke all on table public.branch_question_evidence from anon, authenticated;
revoke all on table public.session_feedback from anon, authenticated;
revoke all on table public.judge_logs from anon, authenticated;
revoke all on table public.safety_events from anon, authenticated;

grant select on table public.thought_sessions to authenticated;
grant select on table public.segments to authenticated;
grant select on table public.messages to authenticated;
grant select on table public.question_nodes to authenticated;
grant select on table public.shift_edges to authenticated;
grant select on table public.shift_edge_evidence to authenticated;
grant select on table public.clarifications to authenticated;
grant select on table public.clarification_evidence to authenticated;
grant select on table public.branch_questions to authenticated;
grant select on table public.branch_question_evidence to authenticated;
grant select on table public.session_feedback to authenticated;

grant all on table public.thought_sessions to service_role;
grant all on table public.segments to service_role;
grant all on table public.messages to service_role;
grant all on table public.question_nodes to service_role;
grant all on table public.shift_edges to service_role;
grant all on table public.shift_edge_evidence to service_role;
grant all on table public.clarifications to service_role;
grant all on table public.clarification_evidence to service_role;
grant all on table public.branch_questions to service_role;
grant all on table public.branch_question_evidence to service_role;
grant all on table public.session_feedback to service_role;
grant all on table public.judge_logs to service_role;
grant all on table public.safety_events to service_role;

create view public.active_thought_sessions
with (security_invoker = true)
as
select
  id,
  user_id,
  origin_branch_id,
  started_at,
  last_activity_at,
  temporary_expires_at
from public.thought_sessions
where status = 'ACTIVE'
  and storage_state = 'TEMPORARY';

create view public.saved_thought_sessions
with (security_invoker = true)
as
select
  id,
  user_id,
  origin_branch_id,
  started_at,
  completed_at,
  retention_decided_at
from public.thought_sessions
where status = 'COMPLETED'
  and storage_state = 'SAVED';

create view public.trashed_thought_sessions
with (security_invoker = true)
as
select
  id,
  user_id,
  origin_branch_id,
  started_at,
  completed_at,
  trashed_at,
  purge_after
from public.thought_sessions
where status = 'COMPLETED'
  and storage_state = 'TRASHED'
  and purge_after > now();

create view public.kept_branch_questions
with (security_invoker = true)
as
select
  id,
  user_id,
  source_session_id,
  source_segment_id,
  source_node_id,
  text,
  kept_at,
  created_at
from public.branch_questions
where retention_state = 'KEPT';

revoke all on table public.active_thought_sessions from anon, authenticated;
revoke all on table public.saved_thought_sessions from anon, authenticated;
revoke all on table public.trashed_thought_sessions from anon, authenticated;
revoke all on table public.kept_branch_questions from anon, authenticated;

grant select on table public.active_thought_sessions to authenticated;
grant select on table public.saved_thought_sessions to authenticated;
grant select on table public.trashed_thought_sessions to authenticated;
grant select on table public.kept_branch_questions to authenticated;

revoke all on function public.can_view_session(uuid) from public;
revoke all on function public.complete_thought_session(uuid) from public;
revoke all on function public.finalize_session_retention(uuid, boolean, uuid[]) from public;
revoke all on function public.move_session_to_trash(uuid) from public;
revoke all on function public.restore_session_from_trash(uuid) from public;
revoke all on function public.delete_kept_branch_question(uuid) from public;
revoke all on function public.submit_session_feedback(uuid, public.feedback_answer) from public;
revoke all on function public.open_next_segment(uuid) from public;
revoke all on function public.consume_past_probe(uuid) from public;
revoke all on function public.record_safety_termination(
  uuid,
  public.safety_label,
  public.safety_category,
  public.safety_behavior,
  public.safety_trigger_source
) from public;
revoke all on function public.delete_pending_branches_before_session_delete() from public;
revoke all on function public.purge_expired_sessions() from public;

grant execute on function public.can_view_session(uuid) to authenticated;
grant execute on function public.complete_thought_session(uuid) to authenticated;
grant execute on function public.finalize_session_retention(uuid, boolean, uuid[]) to authenticated;
grant execute on function public.move_session_to_trash(uuid) to authenticated;
grant execute on function public.restore_session_from_trash(uuid) to authenticated;
grant execute on function public.delete_kept_branch_question(uuid) to authenticated;
grant execute on function public.submit_session_feedback(uuid, public.feedback_answer) to authenticated;
grant execute on function public.open_next_segment(uuid) to authenticated;
grant execute on function public.consume_past_probe(uuid) to authenticated;

grant execute on function public.record_safety_termination(
  uuid,
  public.safety_label,
  public.safety_category,
  public.safety_behavior,
  public.safety_trigger_source
) to service_role;
grant execute on function public.purge_expired_sessions() to service_role;

commit;
