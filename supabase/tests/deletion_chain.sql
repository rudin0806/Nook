-- Synthetic data only. Force deferred constraints before rollback: rollback alone
-- would miss failures that real COMMIT raises. Run via tools/db-replay/replay.mjs.
begin;
do $$
declare
  owner_id uuid := gen_random_uuid();
  source_id uuid := gen_random_uuid();
  first_segment uuid := gen_random_uuid();
  next_segment uuid := gen_random_uuid();
  first_node uuid := gen_random_uuid();
  last_node uuid := gen_random_uuid();
  kept_id uuid := gen_random_uuid();
  pending_id uuid := gen_random_uuid();
  resumed_one uuid := gen_random_uuid();
  resumed_two uuid := gen_random_uuid();
  count_rows integer;
  scenario integer;
  message_id uuid := gen_random_uuid();
  edge_id uuid := gen_random_uuid();
  clarification_id uuid := gen_random_uuid();
  table_name text;
begin
 for scenario in 1..3 loop
  set constraints all deferred;
  insert into auth.users(id) values(owner_id);
  insert into public.thought_sessions(id,user_id) values(source_id,owner_id);
  insert into public.segments(id,session_id,ordinal) values(first_segment,source_id,1);
  insert into public.question_nodes(id,session_id,segment_id,ordinal,kind,ai_proposed_text,final_text,approved_at)
  values(first_node,source_id,first_segment,1,'START','test','test',now()),
        (last_node,source_id,first_segment,2,'SHIFT','test2','test2',now());
  insert into public.branch_questions(id,user_id,source_session_id,source_segment_id,source_node_id,text)
  values(kept_id,owner_id,source_id,first_segment,last_node,'keep'),
        (pending_id,owner_id,source_id,first_segment,last_node,'discard');
  update public.branch_questions set retention_state='KEPT',kept_at=now() where id=kept_id;
  insert into public.messages(id,session_id,segment_id,role,kind,content,sequence_no,user_turn_no)
  values(message_id,source_id,first_segment,'USER','RAW_THOUGHT','synthetic',1,1);
  insert into public.shift_edges(id,session_id,from_node_id,to_node_id,reason_text)
  values(edge_id,source_id,first_node,last_node,'synthetic');
  insert into public.shift_edge_evidence(edge_id,session_id,message_id,position) values(edge_id,source_id,message_id,1);
  insert into public.clarifications(id,session_id,node_id,text) values(clarification_id,source_id,last_node,'synthetic');
  insert into public.clarification_evidence(clarification_id,session_id,message_id,position) values(clarification_id,source_id,message_id,1);
  insert into public.branch_question_evidence(branch_question_id,message_id,position) values(kept_id,message_id,1),(pending_id,message_id,1);
  insert into public.judge_logs(session_id,segment_id,user_message_id,action,shift_confidence,validated_output,model_name,prompt_version,latency_ms)
  values(source_id,first_segment,message_id,'REFLECT','LOW','{}','synthetic','test',0);
  update public.segments set status='CLOSED',closed_at=now() where id=first_segment;
  insert into public.segments(id,session_id,ordinal,anchor_node_id) values(next_segment,source_id,2,last_node);
  insert into public.thought_sessions(id,user_id,origin_branch_id)
  values(resumed_one,owner_id,kept_id),(resumed_two,owner_id,kept_id);
  set constraints all immediate;
  set constraints all deferred;

  -- Referencing an Anchor must not duplicate or count it in the next segment.
  if (select node_count from public.segments where id=next_segment)<>0 then raise exception 'FAIL anchor counted'; end if;
  select count(*) into count_rows from public.question_nodes where session_id=source_id;
  if count_rows<>2 then raise exception 'FAIL anchor duplicated'; end if;
  -- Removing only the Anchor node must fail, while deleting its session may succeed.
  begin
    delete from public.question_nodes where id=last_node;
    set constraints all immediate;
    raise exception 'FAIL anchor deletion permitted';
  exception when foreign_key_violation then null; end;
  set constraints all deferred;
  if not exists(select 1 from public.question_nodes where id=last_node) then raise exception 'FAIL failed delete not rolled back'; end if;

  -- Invalid final source state must still be rejected after the fix.
  begin
    update public.branch_questions set source_session_id=null where id=kept_id;
    set constraints all immediate;
    raise exception 'FAIL inconsistent final source permitted';
  exception when raise_exception then
    if sqlerrm<>'BRANCH_SOURCE_MUST_BE_NULL_TOGETHER' then raise; end if;
  end;
  set constraints all deferred;
  if scenario=3 then
    delete from auth.users where id=owner_id;
    set constraints all immediate;
    if exists(select 1 from public.thought_sessions where user_id=owner_id) or exists(select 1 from public.branch_questions where user_id=owner_id) then raise exception 'FAIL account cascade with live branches'; end if;
    continue;
  end if;
  if scenario=2 then
    perform set_config('request.jwt.claims',json_build_object('sub',owner_id,'is_anonymous',false)::text,true);
    set local role authenticated;
    perform public.delete_kept_branch_question(kept_id);
    reset role;
  end if;
  delete from public.thought_sessions where id=source_id;
  set constraints all immediate;
  if exists(select 1 from public.segments where session_id=source_id) or exists(select 1 from public.question_nodes where session_id=source_id) then raise exception 'FAIL session children remain'; end if;
  if exists(select 1 from public.branch_questions where id=pending_id) then raise exception 'FAIL pending branch remains'; end if;
  if scenario=1 and not exists(select 1 from public.branch_questions where id=kept_id and source_session_id is null and source_segment_id is null and source_node_id is null) then raise exception 'FAIL kept branch lost or source links remain'; end if;
  select count(*) into count_rows from public.thought_sessions where id in(resumed_one,resumed_two) and (origin_branch_id=kept_id or (scenario=2 and origin_branch_id is null));
  if count_rows<>2 then raise exception 'FAIL resumed sessions lost'; end if;

  foreach table_name in array array['segments','messages','question_nodes','shift_edges','shift_edge_evidence','clarifications','clarification_evidence','judge_logs'] loop
    execute format('select count(*) from public.%I where session_id=$1',table_name) into count_rows using source_id;
    if count_rows<>0 then raise exception 'FAIL children remain in %',table_name; end if;
  end loop;
  if exists(select 1 from public.branch_question_evidence where branch_question_id in(kept_id,pending_id)) then raise exception 'FAIL orphan evidence'; end if;
  -- User deletion of kept question leaves both independently started sessions.
  perform set_config('request.jwt.claims',json_build_object('sub',owner_id,'is_anonymous',false)::text,true);
  set local role authenticated;
  if scenario=1 then perform public.delete_kept_branch_question(kept_id); end if;
  reset role;
  set constraints all immediate;
  select count(*) into count_rows from public.thought_sessions where id in(resumed_one,resumed_two) and origin_branch_id is null;
  if count_rows<>2 then raise exception 'FAIL branch deletion broke resumed sessions'; end if;
  delete from auth.users where id=owner_id;
  set constraints all immediate;
  if exists(select 1 from public.thought_sessions where user_id=owner_id) or exists(select 1 from public.branch_questions where user_id=owner_id) then raise exception 'FAIL account children remain'; end if;
 end loop;
end;
$$;
select 'PASS deletion chain, Anchor protection, two resumed sessions, kept question deletion, account deletion' as result;
rollback;
