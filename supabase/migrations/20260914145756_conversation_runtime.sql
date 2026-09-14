begin;
-- Server-owned working state; pending proposals are not Question Nodes.
create table public.conversation_runtime (
 session_id uuid primary key references public.thought_sessions(id) on delete cascade,
 version integer not null default 0 check(version>=0),
 mode text not null default 'READY' check(mode in ('READY','SHIFT','CLOSE','STRUCTURAL','FINISHED','STOP','HANDOFF')),
 pending jsonb,
 last_question_type text check(last_question_type in ('PRESENT','PAST','COMPARE')),
 carryover jsonb not null default '[]'::jsonb check(jsonb_typeof(carryover)='array' and jsonb_array_length(carryover)<=2),
 last_request uuid
);
alter table public.conversation_runtime enable row level security;
create policy conversation_runtime_read_own on public.conversation_runtime for select to authenticated using(public.can_view_session(session_id));
revoke all on public.conversation_runtime from public,anon,authenticated;
grant select on public.conversation_runtime to authenticated;
grant all on public.conversation_runtime to service_role;
create table public.conversation_receipts (
 user_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null,
 session_id uuid not null references public.thought_sessions(id) on delete cascade,
 result jsonb not null,
 primary key(user_id,request_id)
);
alter table public.conversation_receipts enable row level security;
revoke all on public.conversation_receipts from public,anon,authenticated;
grant all on public.conversation_receipts to service_role;
create index conversation_receipts_session_idx on public.conversation_receipts(session_id);
-- CLOSE has no confidence in the validated engine contract. Preserve historical logs.
alter table public.judge_logs alter column shift_confidence drop not null;
alter table public.judge_logs add constraint judge_logs_confidence_action_shape
 check((action='CLOSE' and shift_confidence is null) or (action<>'CLOSE' and shift_confidence is not null)) not valid;

create function public.commit_conversation_step(
 p_user uuid,p_request uuid,p_token uuid,p_fingerprint text,p_session uuid,
 p_version integer,p_phase text,p_text text,p_payload jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 r public.ai_requests%rowtype; s public.thought_sessions%rowtype; g public.segments%rowtype;
 st public.conversation_runtime%rowtype; n public.question_nodes%rowtype;
 mid uuid; new_id uuid; edge_id uuid; evidence_id uuid; seq integer; user_no integer; pos integer;
 item jsonb; ref text; j jsonb; result jsonb; kind text; safety_behavior text; old_pending jsonb;
begin
 if p_user is null or p_request is null or p_token is null or p_session is null or p_version is null or p_version<0
  or p_fingerprint is null or p_fingerprint !~ '^[0-9a-f]{64}$' or p_phase is null
  or p_phase not in ('input','output','approve','reject','continue','finish','safety') or p_payload is null
  or jsonb_typeof(p_payload)<>'object' or length(p_payload::text)>100000 then raise exception 'CONVERSATION_INPUT_INVALID'; end if;
 perform 1 from public.ai_request_limits where user_id=p_user for update;
 select * into r from public.ai_requests where user_id=p_user and request_id=p_request;
 if not found or r.token is distinct from p_token or r.fingerprint is distinct from p_fingerprint
  or r.state<>'RUNNING' or r.deadline<=clock_timestamp() then raise exception 'CONVERSATION_LEASE_INVALID'; end if;
 select * into s from public.thought_sessions where id=p_session and user_id=p_user for update;
 if not found or s.status<>'ACTIVE' or s.storage_state<>'TEMPORARY' or s.temporary_expires_at<=clock_timestamp() then raise exception 'CONVERSATION_SESSION_INVALID'; end if;
 select * into g from public.segments where session_id=p_session and status='ACTIVE' for update;
 if not found then raise exception 'CONVERSATION_SEGMENT_INVALID'; end if;
 select q.* into n from public.question_nodes q join public.segments seg on seg.id=q.segment_id
  where q.session_id=p_session order by seg.ordinal desc,q.ordinal desc limit 1;
 if not found then raise exception 'CONVERSATION_APPROVAL_REQUIRED'; end if;
 insert into public.conversation_runtime(session_id) values(p_session) on conflict do nothing;
 select * into st from public.conversation_runtime where session_id=p_session for update;
 if st.version<>p_version then raise exception 'CONVERSATION_VERSION_CONFLICT'; end if;
 select coalesce(max(sequence_no),0)+1,coalesce(max(user_turn_no),0)+1 into seq,user_no from public.messages where session_id=p_session;
 if p_phase='input' then
  if st.mode<>'READY' or g.node_count>=4 or g.turn_count>=20 or p_text is null or length(btrim(p_text)) not between 1 and 1000 then raise exception 'CONVERSATION_INPUT_BLOCKED'; end if;
  insert into public.messages(session_id,segment_id,role,kind,content,sequence_no,user_turn_no)
   values(p_session,g.id,'USER','USER_REPLY',p_text,seq,user_no) returning id into mid;
  update public.conversation_runtime set version=version+1,last_request=p_request where session_id=p_session;
  return jsonb_build_object('version',p_version+1,'messageId',mid);
 elsif p_phase='safety' then
  safety_behavior=p_payload->>'behavior';
  if safety_behavior is null or safety_behavior not in ('STOP','HANDOFF')
   or (safety_behavior='STOP' and p_text is not null)
   or (safety_behavior='HANDOFF' and (p_text is null or length(btrim(p_text)) not between 1 and 1000)) then raise exception 'CONVERSATION_SAFETY_INVALID'; end if;
  if safety_behavior='HANDOFF' then
   insert into public.messages(session_id,segment_id,role,kind,content,sequence_no,user_turn_no)
    values(p_session,g.id,'USER','USER_REPLY',p_text,seq,user_no);
  end if;
  perform public.record_safety_termination(p_session,(p_payload->>'label')::public.safety_label,(p_payload->>'category')::public.safety_category,safety_behavior::public.safety_behavior,'CLASSIFIER');
  update public.conversation_runtime set mode=safety_behavior,pending=null,carryover='[]' where session_id=p_session;
 elsif p_phase='output' then
  if st.last_request is distinct from p_request or st.mode<>'READY' then raise exception 'CONVERSATION_OUTPUT_CONFLICT'; end if;
  kind=p_payload->>'kind'; j=p_payload->'judge';
  if kind is null or kind not in ('REFLECT','SHIFT','CLOSE','STRUCTURAL','FINISH') then raise exception 'CONVERSATION_OUTPUT_INVALID'; end if;
  select id into mid from public.messages where session_id=p_session and sequence_no=seq-1 and role='USER';
  if mid is null then raise exception 'CONVERSATION_USER_MESSAGE_REQUIRED'; end if;
  if j is not null and j<>'null'::jsonb then
   if j->>'action' is distinct from case when kind='REFLECT' then 'REFLECT' when kind='SHIFT' then 'SHIFT' when kind='CLOSE' then 'CLOSE' else null end then raise exception 'CONVERSATION_JUDGE_INVALID'; end if;
   insert into public.judge_logs(session_id,segment_id,user_message_id,action,shift_confidence,medium_reason,validated_output,model_name,prompt_version,latency_ms,input_tokens,output_tokens)
    values(p_session,g.id,mid,(j->>'action')::public.judge_action,(j->>'shift_confidence')::public.shift_confidence,(j->>'medium_reason')::public.medium_reason,j,
     p_payload#>>'{metadata,configuredModel}',p_payload#>>'{metadata,promptVersion}',(p_payload#>>'{metadata,latencyMs}')::integer,(p_payload#>>'{metadata,inputTokens}')::integer,(p_payload#>>'{metadata,outputTokens}')::integer);
   for ref in select jsonb_array_elements_text(j->'invalidate_clarifications') loop
    update public.clarifications set status='INVALIDATED',invalidated_at=now() where id=ref::uuid and session_id=p_session and node_id=n.id and status='ACTIVE';
    if not found then raise exception 'CONVERSATION_CLARIFICATION_INVALID'; end if;
   end loop;
   for item in select value from jsonb_array_elements(j->'clarifications') loop
    if item->>'confidence'='HIGH' and not exists(select 1 from public.clarifications where node_id=n.id and status='ACTIVE' and text=item->>'text') then
     insert into public.clarifications(session_id,node_id,text) values(p_session,n.id,item->>'text') returning id into new_id;
     pos=0;
     for ref in select jsonb_array_elements_text(item->'evidence_turns') loop
      evidence_id=(p_payload->'turnIds'->>ref)::uuid;pos=pos+1;
      if evidence_id is null or not exists(select 1 from public.messages where id=evidence_id and session_id=p_session and role='USER') then raise exception 'CONVERSATION_EVIDENCE_INVALID'; end if;
      insert into public.clarification_evidence(clarification_id,session_id,message_id,position) values(new_id,p_session,evidence_id,pos);
     end loop;
    end if;
   end loop;
   for item in select value from jsonb_array_elements(j->'branches') loop
    if (select branch_count from public.segments where id=g.id)<5 and not exists(select 1 from public.branch_questions where user_id=p_user and text=item->>'text') then
     insert into public.branch_questions(user_id,source_session_id,source_segment_id,source_node_id,text) values(p_user,p_session,g.id,n.id,item->>'text') returning id into new_id;
     pos=0;
     for ref in select jsonb_array_elements_text(item->'evidence_turns') loop
      evidence_id=(p_payload->'turnIds'->>ref)::uuid;pos=pos+1;
      if evidence_id is null or not exists(select 1 from public.messages where id=evidence_id and session_id=p_session and role='USER') then raise exception 'CONVERSATION_EVIDENCE_INVALID'; end if;
      insert into public.branch_question_evidence(branch_question_id,message_id,position) values(new_id,evidence_id,pos);
     end loop;
    end if;
   end loop;
  end if;
  if kind in ('REFLECT','SHIFT') then
   if p_payload->>'question' is null or length(btrim(p_payload->>'question')) not between 1 and 1000 then raise exception 'CONVERSATION_QUESTION_INVALID'; end if;
   insert into public.messages(session_id,segment_id,role,kind,content,sequence_no)
    values(p_session,g.id,'ASSISTANT',case when kind='SHIFT' then 'SHIFT_PROPOSAL'::public.message_kind else 'REFLECTION'::public.message_kind end,p_payload->>'question',seq);
  end if;
  if kind='REFLECT' then
   if p_payload->>'type'='PAST' then
    if s.past_probe_count<>0 or st.last_question_type='PAST' then raise exception 'CONVERSATION_PAST_NOT_ALLOWED'; end if;
    update public.thought_sessions set past_probe_count=1 where id=p_session;
   end if;
   update public.conversation_runtime set last_question_type=p_payload->>'type',carryover=p_payload->'carryover' where session_id=p_session;
  elsif kind='SHIFT' then
   if g.node_count>=4 or jsonb_array_length(p_payload->'evidence_ids') not between 1 and 10 then raise exception 'CONVERSATION_SHIFT_INVALID'; end if;
   update public.conversation_runtime set mode='SHIFT',pending=jsonb_build_object('question',p_payload->>'question','evidence_sentence',p_payload->>'evidence_sentence','evidence_ids',p_payload->'evidence_ids','promoted_branch_id',p_payload->'promoted_branch_id','one_turn_shift',p_payload->'one_turn_shift') where session_id=p_session;
  elsif kind in ('CLOSE','STRUCTURAL') then
   update public.conversation_runtime set mode=kind where session_id=p_session;
  elsif kind='FINISH' then
   update public.conversation_runtime set mode='FINISHED',pending=null where session_id=p_session;
  end if;
 elsif p_phase='approve' then
  if st.mode<>'SHIFT' or st.pending is null or p_text is null or length(btrim(p_text)) not between 1 and 1000 then raise exception 'CONVERSATION_PROPOSAL_INVALID'; end if;
  if p_text=n.final_text then raise exception 'CONVERSATION_DUPLICATE_QUESTION'; end if;
  old_pending=st.pending;
  insert into public.question_nodes(session_id,segment_id,ordinal,kind,ai_proposed_text,final_text,approved_at)
   values(p_session,g.id,g.node_count+1,'SHIFT',old_pending->>'question',p_text,clock_timestamp()) returning id into new_id;
  insert into public.shift_edges(session_id,from_node_id,to_node_id,reason_text) values(p_session,n.id,new_id,old_pending->>'evidence_sentence') returning id into edge_id;
  pos=0;
  for ref in select jsonb_array_elements_text(old_pending->'evidence_ids') loop
   pos=pos+1;
   if not exists(select 1 from public.messages where id=ref::uuid and session_id=p_session and role='USER') then raise exception 'CONVERSATION_EVIDENCE_INVALID'; end if;
   insert into public.shift_edge_evidence(edge_id,session_id,message_id,position) values(edge_id,p_session,ref::uuid,pos);
  end loop;
  if old_pending->>'promoted_branch_id' is not null then
   if not exists(select 1 from public.branch_questions where id=(old_pending->>'promoted_branch_id')::uuid and user_id=p_user) then raise exception 'CONVERSATION_BRANCH_INVALID'; end if;
   -- Keep the user's later retention choice independent of promotion.
  end if;
  update public.conversation_runtime set pending=null,carryover='[]',last_question_type=null,
   mode=case when g.node_count+1>=4 then 'STRUCTURAL' when (old_pending->>'one_turn_shift')::boolean then 'CLOSE' else 'READY' end where session_id=p_session;
 elsif p_phase='reject' then
  if st.mode<>'SHIFT' then raise exception 'CONVERSATION_PROPOSAL_INVALID'; end if;
  update public.conversation_runtime set pending=null,carryover='[]',mode='READY' where session_id=p_session;
 elsif p_phase='continue' then
  if st.mode not in ('CLOSE','STRUCTURAL') then raise exception 'CONVERSATION_CONTINUE_INVALID'; end if;
  if st.mode='STRUCTURAL' then
   update public.segments set status='CLOSED',closed_at=now() where id=g.id;
   insert into public.segments(session_id,ordinal,anchor_node_id) values(p_session,g.ordinal+1,n.id);
  end if;
  update public.conversation_runtime set mode='READY',pending=null,carryover='[]',last_question_type=null where session_id=p_session;
 elsif p_phase='finish' then
  update public.conversation_runtime set mode='FINISHED',pending=null,carryover='[]' where session_id=p_session;
 end if;
 if (select mode from public.conversation_runtime where session_id=p_session)='FINISHED' then
  update public.segments set status='CLOSED',closed_at=now() where id=g.id;
  update public.thought_sessions set status='COMPLETED',completed_at=now(),last_activity_at=now(),temporary_expires_at=now()+interval '24 hours' where id=p_session;
 end if;
 update public.conversation_runtime set version=version+1,last_request=p_request where session_id=p_session returning * into st;
 result=jsonb_build_object('version',st.version,'mode',st.mode);
 if st.mode in ('STOP','HANDOFF') then result=result||jsonb_build_object('category',p_payload->>'category','label',p_payload->>'label'); end if;
 insert into public.conversation_receipts(user_id,request_id,session_id,result) values(p_user,p_request,p_session,result);
 if not public.finish_ai_request(p_user,p_request,p_token,true,p_session) then raise exception 'CONVERSATION_LEASE_EXPIRED'; end if;
 return result;
end $$;
revoke all on function public.commit_conversation_step(uuid,uuid,uuid,text,uuid,integer,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.commit_conversation_step(uuid,uuid,uuid,text,uuid,integer,text,text,jsonb) to service_role;
-- A segment can reach its turn limit while still using its inherited anchor.
create or replace function public.validate_segment_anchor() returns trigger language plpgsql set search_path='' as $$
declare prev public.segments%rowtype; expected uuid;
begin
 if new.ordinal=1 then return new; end if;
 select * into prev from public.segments where session_id=new.session_id and ordinal=new.ordinal-1;
 if not found then raise exception 'PREVIOUS_SEGMENT_NOT_FOUND'; end if;
 select id into expected from public.question_nodes where segment_id=prev.id order by ordinal desc limit 1;
 expected=coalesce(expected,prev.anchor_node_id);
 if expected is null or new.anchor_node_id is distinct from expected then raise exception 'ANCHOR_MUST_BE_PREVIOUS_SEGMENT_LAST_NODE'; end if;
 return new;
end $$;
commit;
