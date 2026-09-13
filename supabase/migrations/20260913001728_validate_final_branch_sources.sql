begin;

create or replace function public.validate_branch_question_sources()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_session_user_id uuid;
  v_branch public.branch_questions;
begin
  -- Deferred triggers retain intermediate NEW snapshots for each SET NULL FK.
  -- Validate the surviving row after all cascades, or skip a deleted row.
  select * into v_branch from public.branch_questions where id = new.id;
  if not found then return null; end if;

  if v_branch.source_session_id is null then
    if v_branch.source_segment_id is not null or v_branch.source_node_id is not null then
      raise exception 'BRANCH_SOURCE_MUST_BE_NULL_TOGETHER';
    end if;
    return new;
  end if;

  select session_row.user_id
  into v_session_user_id
  from public.thought_sessions session_row
  where session_row.id = v_branch.source_session_id;

  if v_session_user_id is null or v_session_user_id <> v_branch.user_id then
    raise exception 'BRANCH_SOURCE_OWNER_MISMATCH';
  end if;

  if v_branch.source_segment_id is not null and not exists (
    select 1
    from public.segments segment_row
    where segment_row.id = v_branch.source_segment_id
      and segment_row.session_id = v_branch.source_session_id
  ) then
    raise exception 'BRANCH_SOURCE_SEGMENT_MISMATCH';
  end if;

  if v_branch.source_node_id is not null and not exists (
    select 1
    from public.question_nodes node_row
    where node_row.id = v_branch.source_node_id
      and node_row.session_id = v_branch.source_session_id
      and (
        v_branch.source_segment_id is null
        or node_row.segment_id = v_branch.source_segment_id
      )
  ) then
    raise exception 'BRANCH_SOURCE_NODE_MISMATCH';
  end if;

  return new;
end;
$$;

commit;
