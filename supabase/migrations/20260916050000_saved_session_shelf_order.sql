alter table public.thought_sessions
  add column if not exists shelf_position integer;

alter table public.thought_sessions
  add constraint thought_sessions_shelf_position_positive
  check (shelf_position is null or shelf_position > 0);

with ranked as (
  select
    id,
    row_number() over (
      partition by user_id
      order by retention_decided_at desc, id
    )::integer as position
  from public.thought_sessions
  where storage_state = 'SAVED'
)
update public.thought_sessions as session
set shelf_position = ranked.position
from ranked
where session.id = ranked.id
  and session.shelf_position is null;

create index thought_sessions_saved_shelf_order_idx
  on public.thought_sessions (user_id, shelf_position, retention_decided_at desc)
  where storage_state = 'SAVED';

create or replace view public.saved_thought_sessions
with (security_invoker = true)
as
select
  id,
  user_id,
  origin_branch_id,
  started_at,
  completed_at,
  retention_decided_at,
  shelf_position
from public.thought_sessions
where status = 'COMPLETED'
  and storage_state = 'SAVED';

create or replace function public.reorder_saved_sessions(p_session_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  saved_count integer;
begin
  if current_user_id is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'IDENTITY_LINK_REQUIRED';
  end if;

  if p_session_ids is null
    or cardinality(p_session_ids) = 0
    or cardinality(p_session_ids) > 50 then
    raise exception 'INVALID_SHELF_ORDER';
  end if;

  if (select count(*) from unnest(p_session_ids) as requested(id))
    <> (select count(distinct id) from unnest(p_session_ids) as requested(id)) then
    raise exception 'DUPLICATE_SHELF_SESSION';
  end if;

  select count(*)::integer
  into saved_count
  from public.thought_sessions
  where user_id = current_user_id
    and status = 'COMPLETED'
    and storage_state = 'SAVED';

  if cardinality(p_session_ids) <> saved_count then
    raise exception 'SHELF_ORDER_STALE';
  end if;

  if exists (
    select 1
    from unnest(p_session_ids) as requested(id)
    left join public.thought_sessions as session
      on session.id = requested.id
      and session.user_id = current_user_id
      and session.status = 'COMPLETED'
      and session.storage_state = 'SAVED'
    where session.id is null
  ) then
    raise exception 'SHELF_ORDER_STALE';
  end if;

  update public.thought_sessions as session
  set shelf_position = requested.position::integer
  from unnest(p_session_ids) with ordinality as requested(id, position)
  where session.id = requested.id
    and session.user_id = current_user_id
    and session.status = 'COMPLETED'
    and session.storage_state = 'SAVED';
end;
$$;

revoke all on function public.reorder_saved_sessions(uuid[]) from public;
revoke all on function public.reorder_saved_sessions(uuid[]) from anon;
grant execute on function public.reorder_saved_sessions(uuid[]) to authenticated;
