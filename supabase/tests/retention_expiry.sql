-- Isolated empty test database only. Never schedule this fixture in production.
-- The function under test deletes expired rows globally, so refuse nonempty DBs.
begin;
do $$
declare
  owner_id uuid := gen_random_uuid();
  expired_temp uuid := gen_random_uuid();
  boundary_temp uuid := gen_random_uuid();
  future_temp uuid := gen_random_uuid();
  expired_trash uuid := gen_random_uuid();
  boundary_trash uuid := gen_random_uuid();
  future_trash uuid := gen_random_uuid();
  saved_id uuid := gen_random_uuid();
  safety_id uuid := gen_random_uuid();
  deleted_count bigint;
begin
  if exists(select 1 from public.thought_sessions) then
    raise exception 'TEST_DATABASE_MUST_BE_EMPTY';
  end if;
  insert into auth.users(id) values(owner_id);
  insert into public.thought_sessions(id,user_id,temporary_expires_at)
  values(expired_temp,owner_id,now()-interval '1 second'),
        (boundary_temp,owner_id,now()),
        (future_temp,owner_id,now()+interval '1 second');
  insert into public.thought_sessions(id,user_id,status,completed_at,storage_state,retention_decided_at,trashed_at,purge_after,temporary_expires_at)
  values(expired_trash,owner_id,'COMPLETED',now()-interval '8 days','TRASHED',now()-interval '8 days',now()-interval '8 days',now()-interval '1 day',null),
        (boundary_trash,owner_id,'COMPLETED',now()-interval '7 days','TRASHED',now()-interval '7 days',now()-interval '7 days',now(),null),
        (future_trash,owner_id,'COMPLETED',now()-interval '7 days'+interval '1 second','TRASHED',now()-interval '7 days'+interval '1 second',now()-interval '7 days'+interval '1 second',now()+interval '1 second',null),
        (saved_id,owner_id,'COMPLETED',now()-interval '30 days','SAVED',now()-interval '30 days',null,null,null);
  insert into public.thought_sessions(id,user_id,status,completed_at,temporary_expires_at)
  values(safety_id,owner_id,'SAFETY_STOPPED',now()-interval '1 day',now());
  set constraints all immediate;

  set local role authenticated;
  begin
    perform public.purge_expired_sessions();
    raise exception 'FAIL client can purge';
  exception when insufficient_privilege then null; end;
  reset role;

  set local role service_role;
  deleted_count := public.purge_expired_sessions();
  if deleted_count<>5 then raise exception 'FAIL expired count: %',deleted_count; end if;
  if exists(select 1 from public.thought_sessions where id in(expired_temp,boundary_temp,expired_trash,boundary_trash,safety_id)) then raise exception 'FAIL expired rows remain'; end if;
  if (select count(*) from public.thought_sessions where id in(future_temp,future_trash,saved_id))<>3 then raise exception 'FAIL unexpired or saved data deleted'; end if;
  if public.purge_expired_sessions()<>0 then raise exception 'FAIL cleanup not idempotent'; end if;
  reset role;
  set constraints all immediate;
end;
$$;
select 'PASS expiration boundary, saved/unexpired preservation, server-only cleanup, repeat no-op' as result;
rollback;
