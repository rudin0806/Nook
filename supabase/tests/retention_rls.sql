-- Run as postgres in a test database, or as one transaction via execute_sql.
-- Synthetic identities only; all writes are rolled back, even after success.
begin;
do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  sa uuid := gen_random_uuid();
  sb uuid := gen_random_uuid();
  discarded uuid := gen_random_uuid();
  saved public.thought_sessions;
  n integer;
  query text;
begin
  insert into auth.users(id) values(a),(b);
  insert into public.thought_sessions(id,user_id) values(sa,a),(sb,b),(discarded,a);
  perform set_config('request.jwt.claims',json_build_object('sub',a,'is_anonymous',false)::text,true);
  set local role authenticated;
  select count(*) into n from public.thought_sessions where id in (sa,sb,discarded);
  if n<>2 then raise exception 'FAIL own session visibility'; end if;
  if public.can_view_session(sb) then raise exception 'FAIL foreign visibility helper'; end if;
  select count(*) into n from public.active_thought_sessions where id in(sa,sb,discarded);
  if n<>2 then raise exception 'FAIL view RLS'; end if;
  -- All public user mutation RPCs must reject a foreign session/branch.
  foreach query in array array[
    format('select public.complete_thought_session(%L)',sb),
    format('select public.finalize_session_retention(%L,true)',sb),
    format('select public.move_session_to_trash(%L)',sb),
    format('select public.restore_session_from_trash(%L)',sb),
    format('select public.submit_session_feedback(%L,''SAME'')',sb),
    format('select public.open_next_segment(%L)',sb),
    format('select public.consume_past_probe(%L)',sb),
    format('select public.delete_kept_branch_question(%L)',sb)
  ] loop
    begin
      execute query;
      raise exception 'FAIL foreign RPC allowed';
    exception when raise_exception then
      if sqlerrm not in ('SESSION_NOT_FOUND','SAVED_SESSION_NOT_FOUND','RESTORABLE_SESSION_NOT_FOUND','COMPLETED_SESSION_NOT_FOUND','ACTIVE_SESSION_NOT_FOUND','PAST_PROBE_ALREADY_USED_OR_SESSION_NOT_FOUND','KEPT_BRANCH_NOT_FOUND') then raise; end if;
    end;
  end loop;
  begin
    update public.thought_sessions set user_id=b where id=sa;
    raise exception 'FAIL direct writes allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform * from public.judge_logs;
    raise exception 'FAIL judge logs readable';
  exception when insufficient_privilege then null; end;
  begin
    perform * from public.safety_events;
    raise exception 'FAIL safety logs readable';
  exception when insufficient_privilege then null; end;
  perform public.complete_thought_session(sa);
  saved := public.finalize_session_retention(sa,true);
  if saved.storage_state<>'SAVED' or saved.temporary_expires_at is not null then raise exception 'FAIL save'; end if;
  saved := public.move_session_to_trash(sa);
  if saved.storage_state<>'TRASHED' or saved.purge_after<>saved.trashed_at+interval '7 days' then raise exception 'FAIL trash deadline'; end if;
  saved := public.restore_session_from_trash(sa);
  if saved.storage_state<>'SAVED' or saved.purge_after is not null then raise exception 'FAIL restore'; end if;
  perform public.complete_thought_session(discarded);
  perform set_config('request.jwt.claims',json_build_object('sub',a,'is_anonymous',true)::text,true);
  begin
    perform public.finalize_session_retention(discarded,true);
    raise exception 'FAIL anonymous save';
  exception when raise_exception then if sqlerrm<>'IDENTITY_LINK_REQUIRED' then raise; end if; end;
  perform public.finalize_session_retention(discarded,false);
  if exists(select 1 from public.thought_sessions where id=discarded) then raise exception 'FAIL anonymous discard'; end if;
  set local role anon;
  begin
    perform public.complete_thought_session(sb);
    raise exception 'FAIL unauthenticated RPC';
  exception when insufficient_privilege then null; end;
  reset role;
  select count(*) into n from pg_tables where schemaname='public' and rowsecurity;
  if n<13 or exists(select 1 from pg_tables where schemaname='public' and not rowsecurity)
    then raise exception 'FAIL public table RLS coverage'; end if;
  if exists(select 1 from pg_class c join pg_namespace ns on ns.oid=c.relnamespace where ns.nspname='public' and c.relkind='v' and c.relname in ('active_thought_sessions','saved_thought_sessions','trashed_thought_sessions','kept_branch_questions') and not coalesce(c.reloptions @> array['security_invoker=true'],false)) then raise exception 'FAIL view security'; end if;
end;
$$;
select 'PASS: ownership, 8 foreign RPC denials, write/log restrictions, save/trash/restore, anonymous discard, RLS/views' as result;
rollback;
