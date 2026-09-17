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
  leaver_hash text := repeat('a1', 32);
  other_hash text := repeat('b2', 32);
  blocked timestamptz;
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

  -- A signed-out caller cannot delete anything.
  perform set_config('request.jwt.claims','',true);
  set local role anon;
  begin
    perform public.delete_own_account(null);
    reset role;
    raise exception 'FAIL anon permitted';
  exception when insufficient_privilege then reset role;
  end;
  set constraints all deferred;

  -- An authenticated role with no subject claim must still be rejected.
  set local role authenticated;
  begin
    perform public.delete_own_account(null);
    reset role;
    raise exception 'FAIL missing subject permitted';
  exception when raise_exception then
    reset role;
    if sqlerrm <> 'AUTHENTICATION_REQUIRED' then raise; end if;
  end;
  set constraints all deferred;

  -- A malformed hash must not be stored.
  perform set_config('request.jwt.claims',json_build_object('sub',leaver,'is_anonymous',false)::text,true);
  set local role authenticated;
  begin
    perform public.delete_own_account('not-a-hash');
    reset role;
    raise exception 'FAIL malformed hash accepted';
  exception when raise_exception then
    reset role;
    if sqlerrm <> 'IDENTITY_HASH_INVALID' then raise; end if;
  end;
  if not exists(select 1 from auth.users where id=leaver) then
    raise exception 'FAIL account deleted despite a rejected hash';
  end if;
  set constraints all deferred;

  -- The client cannot read or write the block list directly.
  perform set_config('request.jwt.claims',json_build_object('sub',bystander,'is_anonymous',false)::text,true);
  set local role authenticated;
  begin
    perform 1 from public.withdrawn_identities;
    reset role;
    raise exception 'FAIL block list readable by a client';
  exception when insufficient_privilege then reset role;
  end;
  -- The handler above resets the role, so it has to be taken again or the next
  -- check would run as the owner and pass for the wrong reason.
  set local role authenticated;
  begin
    perform public.purge_expired_rejoin_blocks();
    reset role;
    raise exception 'FAIL client ran the block sweep';
  exception when insufficient_privilege then reset role;
  end;
  set constraints all deferred;

  -- Withdrawal: everything goes at once, and the method is blocked.
  perform set_config('request.jwt.claims',json_build_object('sub',leaver,'is_anonymous',false)::text,true);
  set local role authenticated;
  perform public.delete_own_account(leaver_hash);
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
  set constraints all deferred;

  -- The same method is refused for a month; a different one is not.
  perform set_config('request.jwt.claims',json_build_object('sub',bystander,'is_anonymous',false)::text,true);
  set local role authenticated;
  blocked := public.rejoin_blocked_until(leaver_hash);
  if blocked is null then raise exception 'FAIL method not blocked'; end if;
  if blocked < now() + interval '29 days' or blocked > now() + interval '31 days' then
    raise exception 'FAIL block window is not a month: %', blocked;
  end if;
  if public.rejoin_blocked_until(other_hash) is not null then
    raise exception 'FAIL an unrelated method is blocked';
  end if;
  reset role;

  -- Only the hash is kept: no identifier of the account it belonged to.
  if exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='withdrawn_identities'
      and column_name not in ('identity_hash','withdrawn_at','blocked_until')
  ) then
    raise exception 'FAIL block list carries more than the hash and its window';
  end if;

  -- The block is not kept past its window.
  if public.purge_expired_rejoin_blocks() <> 0 then raise exception 'FAIL swept a live block'; end if;
  update public.withdrawn_identities
  set withdrawn_at = now() - interval '31 days', blocked_until = now() - interval '1 minute'
  where identity_hash = leaver_hash;
  if public.purge_expired_rejoin_blocks() <> 1 then raise exception 'FAIL expired block not swept'; end if;
  perform set_config('request.jwt.claims',json_build_object('sub',bystander,'is_anonymous',false)::text,true);
  set local role authenticated;
  if public.rejoin_blocked_until(leaver_hash) is not null then
    raise exception 'FAIL method still blocked after the window';
  end if;
  reset role;
  set constraints all deferred;

  -- An unlinked visitor has no sign-in method to block, and may still leave.
  perform set_config('request.jwt.claims',json_build_object('sub',anonymous_user,'is_anonymous',true)::text,true);
  set local role authenticated;
  perform public.delete_own_account(null);
  reset role;
  set constraints all immediate;
  if exists(select 1 from auth.users where id=anonymous_user) then raise exception 'FAIL anonymous account remains'; end if;
  if exists(select 1 from public.thought_sessions where user_id=anonymous_user) then raise exception 'FAIL anonymous sessions remain'; end if;
  if (select count(*) from public.withdrawn_identities) <> 0 then
    raise exception 'FAIL a visitor with no method left a block behind';
  end if;
end;
$$;
select 'PASS withdrawal deletes at once, blocks the same method for a month, then forgets it' as result;
rollback;
