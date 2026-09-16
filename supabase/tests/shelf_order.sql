-- Run as postgres in a test database, or as one transaction via execute_sql.
-- Synthetic identities only; all writes are rolled back, even after success.
-- The point of this suite: a shelf larger than the old 50-id array can still be reordered.
begin;
do $$
declare
  owner_id uuid := gen_random_uuid();
  other_id uuid := gen_random_uuid();
  anon_id uuid := gen_random_uuid();
  total integer := 60;
  first_id uuid;
  last_id uuid;
  mid_id uuid;
  foreign_id uuid := gen_random_uuid();
  temp_id uuid := gen_random_uuid();
  trash_id uuid := gen_random_uuid();
  n integer;
  p integer;
begin
  insert into auth.users(id) values(owner_id),(other_id),(anon_id);

  insert into public.thought_sessions(id,user_id,status,storage_state,completed_at,retention_decided_at,temporary_expires_at)
  select gen_random_uuid(),owner_id,'COMPLETED','SAVED',now(),now()-(i||' minutes')::interval,null
  from generate_series(1,total) as g(i);

  insert into public.thought_sessions(id,user_id,status,storage_state,completed_at,retention_decided_at,temporary_expires_at)
  values(foreign_id,other_id,'COMPLETED','SAVED',now(),now(),null);

  perform set_config('request.jwt.claims',json_build_object('sub',owner_id,'is_anonymous',false)::text,true);

  -- Newly kept books carry no slot, so normalize must hand out a contiguous 1..N.
  if public.normalize_shelf_positions(owner_id) <> total then
    raise exception 'FAIL normalize count';
  end if;
  select count(distinct shelf_position) into n from public.thought_sessions
   where user_id=owner_id and storage_state='SAVED';
  if n <> total then raise exception 'FAIL positions not distinct'; end if;
  select count(*) into n from public.thought_sessions
   where user_id=owner_id and storage_state='SAVED' and shelf_position between 1 and total;
  if n <> total then raise exception 'FAIL positions not contiguous'; end if;

  select id into first_id from public.thought_sessions
   where user_id=owner_id and storage_state='SAVED' and shelf_position=1;
  select id into last_id from public.thought_sessions
   where user_id=owner_id and storage_state='SAVED' and shelf_position=total;

  set local role authenticated;

  -- The old whole-array RPC rejected anything past 50; moving one book must not.
  if public.move_saved_session(last_id,1) <> 1 then raise exception 'FAIL move to front'; end if;
  select shelf_position into p from public.thought_sessions where id=last_id;
  if p <> 1 then raise exception 'FAIL front not persisted'; end if;
  select shelf_position into p from public.thought_sessions where id=first_id;
  if p <> 2 then raise exception 'FAIL neighbour not shifted down'; end if;
  select count(*) into n from public.thought_sessions
   where user_id=owner_id and storage_state='SAVED' and shelf_position between 1 and total;
  if n <> total then raise exception 'FAIL contiguity after front move'; end if;

  -- Moving back to the tail shifts the other direction.
  if public.move_saved_session(last_id,total) <> total then raise exception 'FAIL move to tail'; end if;
  select shelf_position into p from public.thought_sessions where id=first_id;
  if p <> 1 then raise exception 'FAIL tail move did not restore neighbour'; end if;

  -- A target past the end clamps instead of leaving a gap.
  if public.move_saved_session(first_id,total+500) <> total then raise exception 'FAIL clamp'; end if;
  select count(distinct shelf_position) into n from public.thought_sessions
   where user_id=owner_id and storage_state='SAVED';
  if n <> total then raise exception 'FAIL clamp broke distinctness'; end if;

  -- Only the span between the old and the new slot moves.
  select id into mid_id from public.thought_sessions
   where user_id=owner_id and storage_state='SAVED' and shelf_position=30;
  if public.move_saved_session(mid_id,10) <> 10 then raise exception 'FAIL mid move'; end if;
  select count(*) into n from public.thought_sessions
   where user_id=owner_id and storage_state='SAVED' and shelf_position between 1 and 9;
  if n <> 9 then raise exception 'FAIL head disturbed'; end if;
  select count(*) into n from public.thought_sessions
   where user_id=owner_id and storage_state='SAVED' and shelf_position between 31 and total;
  if n <> total-30 then raise exception 'FAIL tail disturbed'; end if;

  -- Ownership and input guards.
  begin
    perform public.move_saved_session(foreign_id,1);
    raise exception 'FAIL foreign move allowed';
  exception when raise_exception then
    if sqlerrm <> 'SAVED_SESSION_NOT_FOUND' then raise; end if;
  end;
  begin
    perform public.move_saved_session(first_id,0);
    raise exception 'FAIL zero position allowed';
  exception when raise_exception then
    if sqlerrm <> 'INVALID_SHELF_POSITION' then raise; end if;
  end;

  reset role;
  perform set_config('request.jwt.claims',json_build_object('sub',anon_id,'is_anonymous',true)::text,true);
  set local role authenticated;
  begin
    perform public.move_saved_session(first_id,1);
    raise exception 'FAIL anonymous move allowed';
  exception when raise_exception then
    if sqlerrm <> 'IDENTITY_LINK_REQUIRED' then raise; end if;
  end;

  -- Keeping and restoring must place the book on the shelf, not leave it unslotted.
  reset role;
  perform set_config('request.jwt.claims',json_build_object('sub',owner_id,'is_anonymous',false)::text,true);
  insert into public.thought_sessions(id,user_id,status,storage_state,temporary_expires_at)
  values(temp_id,owner_id,'ACTIVE','TEMPORARY',now()+interval '1 hour');
  set local role authenticated;
  perform public.finalize_session_retention(temp_id,true);
  select shelf_position into p from public.thought_sessions where id=temp_id;
  if p is null then raise exception 'FAIL kept session has no slot'; end if;

  reset role;
  insert into public.thought_sessions(id,user_id,status,storage_state,completed_at,retention_decided_at,trashed_at,purge_after,temporary_expires_at)
  values(trash_id,owner_id,'COMPLETED','TRASHED',now(),now(),now(),now()+interval '7 days',null);
  set local role authenticated;
  perform public.restore_session_from_trash(trash_id);
  select shelf_position into p from public.thought_sessions where id=trash_id;
  if p is null then raise exception 'FAIL restored session has no slot'; end if;

  -- Trashing frees the slot so the shelf stays contiguous.
  perform public.move_session_to_trash(trash_id);
  select shelf_position into p from public.thought_sessions where id=trash_id;
  if p is not null then raise exception 'FAIL trashed session kept its slot'; end if;
  select count(*) into n from public.thought_sessions
   where user_id=owner_id and storage_state='SAVED';
  select count(*) into p from public.thought_sessions
   where user_id=owner_id and storage_state='SAVED' and shelf_position between 1 and n;
  if p <> n then raise exception 'FAIL contiguity after trash'; end if;
end;
$$;
select 'PASS 60-book shelf: normalize, front/tail/clamp/mid moves, ownership, anonymous and input guards, keep/restore/trash slotting' as result;
rollback;
