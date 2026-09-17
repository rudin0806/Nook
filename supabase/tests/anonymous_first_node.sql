-- Synthetic data only. Run via tools/db-replay/replay.mjs.
-- A visitor without an account reaches the first question and may talk inside
-- it; approving a second question is where the account is required.
begin;
do $$
declare
  visitor uuid := gen_random_uuid();
  member uuid := gen_random_uuid();
  fp1 text := repeat('7', 64);
  fp2 text := repeat('8', 64);
  fp3 text := repeat('9', 64);
  visitor_session uuid := '92000000-0000-4000-8000-000000000001';
  member_session uuid := '92000000-0000-4000-8000-000000000002';
  visitor_segment uuid := '92000000-0000-4000-8000-000000000011';
  member_segment uuid := '92000000-0000-4000-8000-000000000012';
  visitor_node uuid := '92000000-0000-4000-8000-000000000021';
  member_node uuid := '92000000-0000-4000-8000-000000000022';
  visitor_message uuid := '92000000-0000-4000-8000-000000000031';
  member_message uuid := '92000000-0000-4000-8000-000000000032';
  req uuid;
  tok uuid;
begin
  insert into auth.users(id,is_anonymous) values(visitor,true),(member,false);

  insert into public.thought_sessions(id,user_id) values(visitor_session,visitor),(member_session,member);
  insert into public.segments(id,session_id,ordinal) values(visitor_segment,visitor_session,1),(member_segment,member_session,1);
  insert into public.question_nodes(id,session_id,segment_id,ordinal,kind,ai_proposed_text,final_text,approved_at)
  values(visitor_node,visitor_session,visitor_segment,1,'START','제안','첫 질문',now()),
        (member_node,member_session,member_segment,1,'START','제안','첫 질문',now());
  insert into public.messages(id,session_id,segment_id,role,kind,content,sequence_no,user_turn_no)
  values(visitor_message,visitor_session,visitor_segment,'USER','USER_REPLY','방문자의 답',2,1),
        (member_message,member_session,member_segment,'USER','USER_REPLY','회원의 답',2,1);
  insert into public.conversation_runtime(session_id,mode,pending)
  values(visitor_session,'SHIFT',jsonb_build_object('question','두 번째 질문','evidence_sentence','근거',
           'evidence_ids',jsonb_build_array(visitor_message),'promoted_branch_id',null,'one_turn_shift',false)),
        (member_session,'SHIFT',jsonb_build_object('question','두 번째 질문','evidence_sentence','근거',
           'evidence_ids',jsonb_build_array(member_message),'promoted_branch_id',null,'one_turn_shift',false));

  -- A visitor may still speak inside the first question.
  update public.conversation_runtime set mode='READY',pending=null where session_id=visitor_session;
  req=gen_random_uuid(); tok=(public.claim_ai_request(visitor,req,fp1)->>'token')::uuid;
  perform public.commit_conversation_step(visitor,req,tok,fp1,visitor_session,
    (select version from public.conversation_runtime where session_id=visitor_session),
    'input','첫 질문 안에서 더 쓰는 말','{}');
  perform public.finish_ai_request(visitor,req,tok,true);
  if not exists(select 1 from public.messages where session_id=visitor_session and content='첫 질문 안에서 더 쓰는 말') then
    raise exception 'FAIL visitor cannot talk inside the first question';
  end if;

  -- Moving to a second question asks the visitor for an account.
  update public.conversation_runtime set mode='SHIFT',pending=jsonb_build_object(
    'question','두 번째 질문','evidence_sentence','근거',
    'evidence_ids',jsonb_build_array(visitor_message),'promoted_branch_id',null,'one_turn_shift',false)
  where session_id=visitor_session;
  req=gen_random_uuid(); tok=(public.claim_ai_request(visitor,req,fp2)->>'token')::uuid;
  begin
    perform public.commit_conversation_step(visitor,req,tok,fp2,visitor_session,
      (select version from public.conversation_runtime where session_id=visitor_session),
      'approve','두 번째 질문','{}');
    raise exception 'FAIL visitor approved a second question';
  exception when raise_exception then
    if sqlerrm <> 'IDENTITY_LINK_REQUIRED' then raise; end if;
  end;
  perform public.finish_ai_request(visitor,req,tok,false);
  if (select count(*) from public.question_nodes where session_id=visitor_session) <> 1 then
    raise exception 'FAIL a second node was created for the visitor';
  end if;
  -- The proposal survives the refusal, so the screen can keep showing it.
  if (select pending->>'question' from public.conversation_runtime where session_id=visitor_session)
     is distinct from '두 번째 질문' then
    raise exception 'FAIL the proposal was lost on refusal';
  end if;

  -- The same move succeeds for a member.
  req=gen_random_uuid(); tok=(public.claim_ai_request(member,req,fp3)->>'token')::uuid;
  perform public.commit_conversation_step(member,req,tok,fp3,member_session,
    (select version from public.conversation_runtime where session_id=member_session),
    'approve','두 번째 질문','{}');
  if (select count(*) from public.question_nodes where session_id=member_session) <> 2 then
    raise exception 'FAIL a member could not reach a second question';
  end if;
end;
$$;
select 'PASS a visitor reaches the first question only, a member goes further' as result;
rollback;
