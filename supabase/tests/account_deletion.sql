-- Synthetic data only. Force deferred constraints before rollback: rollback alone
-- would miss failures that real COMMIT raises. Run via tools/db-replay/replay.mjs.
begin;
do $$
declare
  leaver uuid := gen_random_uuid();
  bystander uuid := gen_random_uuid();
  leaver_session uuid := gen_random_uuid();
  bystander_session uuid := gen_random_uuid();
  leaver_segment uuid := gen_random_uuid();
  bystander_segment uuid := gen_random_uuid();
  leaver_message uuid := gen_random_uuid();
  bystander_message uuid := gen_random_uuid();
  leaver_node uuid := gen_random_uuid();
  leaver_branch uuid := gen_random_uuid();
  anonymous_user uuid := gen_random_uuid();
  anonymous_session uuid := gen_random_uuid();
  deadline timestamptz;
  removed integer;
begin
  set constraints all deferred;
  insert into auth.users(id) values(leaver),(bystander);
  insert into auth.users(id,is_anonymous) values(anonymous_user,true);

  insert into public.thought_sessions(id,user_id) values(leaver_session,leaver),(bystander_session,bystander),(anonymous_session,anonymous_user);
  insert into public.segments(id,session_id,ordinal) values(leaver_segment,leaver_session,1),(bystander_segment,bystander_session,1);
  insert into public.messages(id,session_id,segment_id,role,kind,content,sequence_no,user_turn_no)
  values(leaver_message,leaver_session,leaver_segment,'USER','RAW_THOUGHT','leaver wrote this',1,1),
        (bystander_message,bystander_session,bystander_segment,'USER','RAW_THOUGHT','bystander wrote this',1,1);
  insert into public.question_nodes(id,session_id,segment_id,ordinal,kind,ai_proposed_text,final_text,approved_at)
  values(leaver_node,leaver_session,leaver_segment,1,'START','proposed','final',now());
  insert into public.branch_questions(id,user_id,source_session_id,source_segment_id,source_node_id,text)
  values(leaver_branch,leaver,leaver_session,leaver_segment,leaver_node,'leaver question');
  insert into public.ai_request_limits(user_id) values(leaver),(bystander);
  set constraints all immediate;
  set constraints all deferred;

  -- A signed-out caller cannot request or cancel anything.
  perform set_config('request.jwt.claims','',true);
  set local role anon;
  begin
    perform public.request_account_deletion();
    reset role;
    raise exception 'FAIL anon permitted';
  exception when insufficient_privilege then reset role;
  end;
  set constraints all deferred;

  -- An authenticated role with no subject claim must still be rejected.
  set local role authenticated;
  begin
    perform public.request_account_deletion();
    reset role;
    raise exception 'FAIL missing subject permitted';
  exception when raise_exception then
    reset role;
    if sqlerrm <> 'AUTHENTICATION_REQUIRED' then raise; end if;
  end;
  set constraints all deferred;

  -- Requesting withdrawal marks the account and deletes nothing yet.
  perform set_config('request.jwt.claims',json_build_object('sub',leaver,'is_anonymous',false)::text,true);
  set local role authenticated;
  deadline := public.request_account_deletion();
  reset role;
  if deadline is null then raise exception 'FAIL no deadline returned'; end if;
  if deadline < now() + interval '29 days' or deadline > now() + interval '31 days' then
    raise exception 'FAIL grace window is not a month: %', deadline;
  end if;
  if not exists(select 1 from auth.users where id=leaver) then raise exception 'FAIL account removed immediately'; end if;
  if not exists(select 1 from public.messages where id=leaver_message) then raise exception 'FAIL records removed immediately'; end if;

  -- Asking twice keeps the original deadline rather than extending it.
  perform set_config('request.jwt.claims',json_build_object('sub',leaver,'is_anonymous',false)::text,true);
  set local role authenticated;
  if public.request_account_deletion() <> deadline then
    raise exception 'FAIL repeat request moved the deadline';
  end if;
  reset role;

  -- Nothing is due yet, so a purge must remove nobody.
  if public.purge_expired_accounts() <> 0 then raise exception 'FAIL purged before the deadline'; end if;
  if not exists(select 1 from auth.users where id=leaver) then raise exception 'FAIL account purged early'; end if;

  -- The member can take it back while the window is open.
  perform set_config('request.jwt.claims',json_build_object('sub',leaver,'is_anonymous',false)::text,true);
  set local role authenticated;
  perform public.cancel_account_deletion();
  begin
    perform public.cancel_account_deletion();
    reset role;
    raise exception 'FAIL cancelling twice permitted';
  exception when raise_exception then
    reset role;
    if sqlerrm <> 'NO_PENDING_DELETION' then raise; end if;
  end;
  if exists(select 1 from public.account_deletions where user_id=leaver) then
    raise exception 'FAIL cancel left the mark';
  end if;

  -- Request again and let the window close: the purge takes the account and
  -- everything that hangs off it, and touches nobody else.
  perform set_config('request.jwt.claims',json_build_object('sub',leaver,'is_anonymous',false)::text,true);
  set local role authenticated;
  perform public.request_account_deletion();
  reset role;
  update public.account_deletions set requested_at = now() - interval '31 days',
    purge_after = now() - interval '1 minute' where user_id=leaver;
  removed := public.purge_expired_accounts();
  set constraints all immediate;
  if removed <> 1 then raise exception 'FAIL purge removed % accounts', removed; end if;

  if exists(select 1 from auth.users where id=leaver) then raise exception 'FAIL account row remains'; end if;
  if exists(select 1 from public.account_deletions where user_id=leaver) then raise exception 'FAIL deletion mark remains'; end if;
  if exists(select 1 from public.thought_sessions where user_id=leaver) then raise exception 'FAIL sessions remain'; end if;
  if exists(select 1 from public.segments where session_id=leaver_session) then raise exception 'FAIL segments remain'; end if;
  if exists(select 1 from public.messages where session_id=leaver_session) then raise exception 'FAIL written thoughts remain'; end if;
  if exists(select 1 from public.question_nodes where session_id=leaver_session) then raise exception 'FAIL question nodes remain'; end if;
  if exists(select 1 from public.branch_questions where user_id=leaver) then raise exception 'FAIL kept questions remain'; end if;
  if exists(select 1 from public.ai_request_limits where user_id=leaver) then raise exception 'FAIL request counters remain'; end if;

  if not exists(select 1 from auth.users where id=bystander) then raise exception 'FAIL bystander account deleted'; end if;
  if not exists(select 1 from public.messages where id=bystander_message) then raise exception 'FAIL bystander thoughts deleted'; end if;
  set constraints all deferred;

  -- A client role must not be able to run the purge itself.
  perform set_config('request.jwt.claims',json_build_object('sub',bystander,'is_anonymous',false)::text,true);
  set local role authenticated;
  begin
    perform public.purge_expired_accounts();
    reset role;
    raise exception 'FAIL authenticated ran the purge';
  exception when insufficient_privilege then reset role;
  end;

  -- The mark is read-only to clients, so a deadline cannot be forged or moved.
  if exists(
    select 1 from information_schema.role_table_grants
    where table_schema='public' and table_name='account_deletions'
      and grantee='authenticated' and privilege_type <> 'SELECT'
  ) then
    raise exception 'FAIL authenticated holds more than SELECT on account_deletions';
  end if;

  -- Withdrawal is a data-subject right, so an unlinked visitor may use it too.
  perform set_config('request.jwt.claims',json_build_object('sub',anonymous_user,'is_anonymous',true)::text,true);
  set local role authenticated;
  perform public.request_account_deletion();
  reset role;
  update public.account_deletions set requested_at = now() - interval '31 days',
    purge_after = now() - interval '1 minute' where user_id=anonymous_user;
  perform public.purge_expired_accounts();
  set constraints all immediate;
  if exists(select 1 from auth.users where id=anonymous_user) then raise exception 'FAIL anonymous account remains'; end if;
  if exists(select 1 from public.thought_sessions where user_id=anonymous_user) then raise exception 'FAIL anonymous sessions remain'; end if;
end;
$$;
select 'PASS withdrawal marks, holds for a month, cancels, then purges only the caller' as result;
rollback;
