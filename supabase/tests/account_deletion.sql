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

  -- A signed-out caller must not be able to delete anything.
  perform set_config('request.jwt.claims','',true);
  set local role anon;
  begin
    perform public.delete_own_account();
    reset role;
    raise exception 'FAIL anonymous role permitted';
  exception when insufficient_privilege then reset role;
  end;
  set constraints all deferred;

  -- An authenticated role with no subject claim must still be rejected.
  set local role authenticated;
  begin
    perform public.delete_own_account();
    reset role;
    raise exception 'FAIL missing subject permitted';
  exception when raise_exception then
    reset role;
    if sqlerrm <> 'AUTHENTICATION_REQUIRED' then raise; end if;
  end;
  set constraints all deferred;

  -- The member deletes their own account and nothing of anyone else's.
  perform set_config('request.jwt.claims',json_build_object('sub',leaver,'is_anonymous',false)::text,true);
  set local role authenticated;
  perform public.delete_own_account();
  reset role;
  set constraints all immediate;

  if exists(select 1 from auth.users where id=leaver) then raise exception 'FAIL account row remains'; end if;
  if exists(select 1 from public.thought_sessions where user_id=leaver) then raise exception 'FAIL sessions remain'; end if;
  if exists(select 1 from public.segments where session_id=leaver_session) then raise exception 'FAIL segments remain'; end if;
  if exists(select 1 from public.messages where session_id=leaver_session) then raise exception 'FAIL written thoughts remain'; end if;
  if exists(select 1 from public.question_nodes where session_id=leaver_session) then raise exception 'FAIL question nodes remain'; end if;
  if exists(select 1 from public.branch_questions where user_id=leaver) then raise exception 'FAIL kept questions remain'; end if;
  if exists(select 1 from public.ai_request_limits where user_id=leaver) then raise exception 'FAIL request counters remain'; end if;

  if not exists(select 1 from auth.users where id=bystander) then raise exception 'FAIL bystander account deleted'; end if;
  if not exists(select 1 from public.messages where id=bystander_message) then raise exception 'FAIL bystander thoughts deleted'; end if;
  if not exists(select 1 from public.ai_request_limits where user_id=bystander) then raise exception 'FAIL bystander counters deleted'; end if;
  set constraints all deferred;

  -- Withdrawal is a data-subject right, so an unlinked visitor may use it too.
  perform set_config('request.jwt.claims',json_build_object('sub',anonymous_user,'is_anonymous',true)::text,true);
  set local role authenticated;
  perform public.delete_own_account();
  reset role;
  set constraints all immediate;
  if exists(select 1 from auth.users where id=anonymous_user) then raise exception 'FAIL anonymous account remains'; end if;
  if exists(select 1 from public.thought_sessions where user_id=anonymous_user) then raise exception 'FAIL anonymous sessions remain'; end if;
end;
$$;
select 'PASS account deletion removes only the caller''s data, rejects signed-out callers' as result;
rollback;
