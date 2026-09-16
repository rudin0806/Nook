-- Ordering a shelf required sending every SAVED id at once, and the array was capped at 50,
-- so a user past 50 books could not reorder at all. Moving one book needs only that book.

-- Rewrites the user's shelf as contiguous 1..N. Unplaced books land in front, newest first,
-- which is where a freshly kept book belongs.
create or replace function public.normalize_shelf_positions(p_user uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  with ranked as (
    select
      id,
      row_number() over (
        order by shelf_position nulls first, retention_decided_at desc, id
      )::integer as position
    from public.thought_sessions
    where user_id = p_user
      and status = 'COMPLETED'
      and storage_state = 'SAVED'
  )
  update public.thought_sessions as session
  set shelf_position = ranked.position
  from ranked
  where session.id = ranked.id
    and session.shelf_position is distinct from ranked.position;

  select count(*)::integer
  into v_count
  from public.thought_sessions
  where user_id = p_user
    and status = 'COMPLETED'
    and storage_state = 'SAVED';

  return v_count;
end;
$$;

revoke all on function public.normalize_shelf_positions(uuid) from public, anon, authenticated;
grant execute on function public.normalize_shelf_positions(uuid) to service_role;

-- Shifts only the books between the old and the new slot, so a concurrent move elsewhere
-- on the shelf is not overwritten the way a whole-array write did.
create or replace function public.move_saved_session(
  p_session_id uuid,
  p_target_position integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_total integer;
  v_current integer;
  v_target integer;
begin
  if v_user_id is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'IDENTITY_LINK_REQUIRED';
  end if;

  if p_session_id is null or p_target_position is null or p_target_position < 1 then
    raise exception 'INVALID_SHELF_POSITION';
  end if;

  perform 1 from public.ai_request_limits where user_id = v_user_id for update;

  v_total := public.normalize_shelf_positions(v_user_id);

  select shelf_position
  into v_current
  from public.thought_sessions
  where id = p_session_id
    and user_id = v_user_id
    and status = 'COMPLETED'
    and storage_state = 'SAVED';

  if v_current is null then
    raise exception 'SAVED_SESSION_NOT_FOUND';
  end if;

  v_target := least(p_target_position, v_total);

  if v_target = v_current then
    return v_current;
  end if;

  if v_target < v_current then
    update public.thought_sessions
    set shelf_position = shelf_position + 1
    where user_id = v_user_id
      and status = 'COMPLETED'
      and storage_state = 'SAVED'
      and shelf_position >= v_target
      and shelf_position < v_current;
  else
    update public.thought_sessions
    set shelf_position = shelf_position - 1
    where user_id = v_user_id
      and status = 'COMPLETED'
      and storage_state = 'SAVED'
      and shelf_position > v_current
      and shelf_position <= v_target;
  end if;

  update public.thought_sessions
  set shelf_position = v_target
  where id = p_session_id;

  return v_target;
end;
$$;

revoke all on function public.move_saved_session(uuid, integer) from public, anon;
grant execute on function public.move_saved_session(uuid, integer) to authenticated;

-- Keeping a session and restoring one from trash both left shelf_position null, so a book
-- had no slot until the user reordered by hand.
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

  perform 1 from public.ai_request_limits where user_id=v_user_id for update;

  select session_row.*
  into v_session
  from public.thought_sessions session_row
  where session_row.id = target_session_id
    and session_row.user_id = v_user_id
  for update;

  if v_session.id is null then
    raise exception 'SESSION_NOT_FOUND';
  end if;

  if v_session.status='COMPLETED' and v_session.storage_state::text=(case when keep_session then 'SAVED' else 'TRASHED' end)
    and (v_session.storage_state<>'TRASHED' or v_session.purge_after>now())
    and v_session.retention_decided_at is not null and v_session.retention_source is distinct from 'EXPIRED'
    and (select coalesce(array_agg(id order by id),'{}'::uuid[]) from public.branch_questions where source_session_id=target_session_id and retention_state='KEPT')
      = (select coalesce(array_agg(distinct x order by x),'{}'::uuid[]) from unnest(kept_branch_ids) x) then
    return v_session;
  end if;
  if v_session.status not in ('ACTIVE','COMPLETED')
    or v_session.storage_state <> 'TEMPORARY' or v_session.temporary_expires_at<=now() then
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

  update public.segments set status='CLOSED',closed_at=now() where session_id=target_session_id and status='ACTIVE';
  update public.thought_sessions set status='COMPLETED',completed_at=coalesce(completed_at,now()),retention_source='USER' where id=target_session_id;
  update public.conversation_runtime set mode='FINISHED',pending=null,version=version+1 where session_id=target_session_id;

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
        temporary_expires_at = null,
        shelf_position = null
    where id = target_session_id
    returning * into v_session;

    perform public.normalize_shelf_positions(v_user_id);

    select * into v_session from public.thought_sessions where id = target_session_id;
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
        temporary_expires_at = null,
        shelf_position = null
    where id = target_session_id
    returning * into v_session;
  end if;

  return v_session;
end;
$$;

create or replace function public.restore_session_from_trash(target_session_id uuid)
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
      retention_source='USER',
      retention_decided_at = now(),
      trashed_at = null,
      purge_after = null,
      temporary_expires_at = null,
      shelf_position = null
  where id = target_session_id
    and user_id = v_user_id
    and status = 'COMPLETED'
    and storage_state = 'TRASHED'
    and purge_after > now()
  returning * into v_session;

  if v_session.id is null then
    raise exception 'RESTORABLE_SESSION_NOT_FOUND';
  end if;

  perform public.normalize_shelf_positions(v_user_id);

  select * into v_session from public.thought_sessions where id = target_session_id;

  return v_session;
end;
$$;

-- A book that leaves the shelf must not keep its slot, or the next normalize leaves a gap.
create or replace function public.move_session_to_trash(target_session_id uuid)
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
      retention_source = 'USER',
      retention_decided_at = now(),
      trashed_at = now(),
      purge_after = now() + interval '7 days',
      temporary_expires_at = null,
      shelf_position = null
  where id = target_session_id
    and user_id = v_user_id
    and status = 'COMPLETED'
    and storage_state = 'SAVED'
  returning * into v_session;

  if v_session.id is null then
    raise exception 'SAVED_SESSION_NOT_FOUND';
  end if;

  perform public.normalize_shelf_positions(v_user_id);

  return v_session;
end;
$$;
