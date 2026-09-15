begin;
alter table public.thought_sessions add column retention_source text check(retention_source in ('USER','EXPIRED'));
-- Owner-scoped maintenance uses the same user -> session lock order as AI commits.
create function public.settle_retention_for_user(p_user uuid) returns bigint
language plpgsql security definer set search_path='' as $$
declare s public.thought_sessions; deleted bigint := 0; n bigint; linked boolean;
begin
 perform 1 from public.ai_request_limits where user_id=p_user for update;
 select not coalesce(is_anonymous,true) into linked from auth.users where id=p_user;
 for s in select * from public.thought_sessions where user_id=p_user
  and ((storage_state='TEMPORARY' and temporary_expires_at<=now())
    or (storage_state='TRASHED' and purge_after<=now())) order by id for update loop
  if s.storage_state='TEMPORARY' and linked and s.status in ('ACTIVE','COMPLETED') then
   update public.segments set status='CLOSED',closed_at=coalesce(closed_at,s.temporary_expires_at)
    where session_id=s.id and status='ACTIVE';
   update public.conversation_runtime set mode='FINISHED',pending=null,version=version+1 where session_id=s.id;
   update public.thought_sessions set status='COMPLETED',completed_at=coalesce(completed_at,s.temporary_expires_at),
    storage_state='TRASHED',retention_source='EXPIRED',retention_decided_at=s.temporary_expires_at,trashed_at=s.temporary_expires_at,purge_after=s.temporary_expires_at+interval '7 days',
    temporary_expires_at=null where id=s.id;
   if s.temporary_expires_at+interval '7 days'>now() then continue; end if;
  end if;
  delete from public.thought_sessions where id=s.id;
  get diagnostics n = row_count; deleted=deleted+n;
 end loop;
 return deleted;
end $$;
revoke all on function public.settle_retention_for_user(uuid) from public,anon,authenticated;
grant execute on function public.settle_retention_for_user(uuid) to service_role;
create function public.settle_own_retention() returns bigint language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
 return public.settle_retention_for_user(auth.uid());
end $$;
revoke all on function public.settle_own_retention() from public,anon;
grant execute on function public.settle_own_retention() to authenticated;
create or replace function public.purge_expired_sessions() returns bigint
language plpgsql security definer set search_path='' as $$
declare u uuid; total bigint:=0;
begin
 for u in select distinct user_id from public.thought_sessions
 where (storage_state='TEMPORARY' and temporary_expires_at<=now()) or (storage_state='TRASHED' and purge_after<=now()) order by user_id loop
  total=total+public.settle_retention_for_user(u);
 end loop;
 return total;
end $$;
-- Expired rows must not remain readable while waiting for scheduled physical cleanup.
create or replace function public.can_view_session(target_session_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.thought_sessions s where s.id=target_session_id and s.user_id=auth.uid()
 and s.status in ('ACTIVE','COMPLETED') and
 (s.storage_state='SAVED' or (s.storage_state='TEMPORARY' and s.temporary_expires_at>now())
 or (s.storage_state='TRASHED' and s.purge_after>now())));
$$;
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
        temporary_expires_at = null
    where id = target_session_id
    returning * into v_session;
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
        temporary_expires_at = null
    where id = target_session_id
    returning * into v_session;
  end if;

  return v_session;
end;
$$;


create table public.session_origins(
 session_id uuid primary key references public.thought_sessions(id) on delete cascade,
 source_session_id uuid references public.thought_sessions(id) on delete set null deferrable initially deferred,
 source_node_id uuid references public.question_nodes(id) on delete set null deferrable initially deferred,
 source_branch_id uuid references public.branch_questions(id) on delete set null deferrable initially deferred
);
create index session_origins_parent_idx on public.session_origins(source_session_id);
create index session_origins_node_idx on public.session_origins(source_node_id);
create index session_origins_branch_idx on public.session_origins(source_branch_id);
alter table public.session_origins enable row level security;
create policy session_origins_read_own on public.session_origins for select to authenticated using(public.can_view_session(session_id));
revoke all on public.session_origins from public,anon,authenticated;
grant select on public.session_origins to authenticated;
grant all on public.session_origins to service_role;
-- Server-only, validated start result; signed receipts are generated only on an owned live recovery.
create table public.start_drafts(
 session_id uuid primary key references public.thought_sessions(id) on delete cascade,
 message_id uuid not null references public.messages(id) on delete cascade,
 result jsonb not null check(result->>'kind' in ('PROPOSAL','CLEAR_AS_IS','FOCUS_REQUIRED','NEEDS_INFO'))
);
create index start_drafts_message_idx on public.start_drafts(message_id);
alter table public.start_drafts enable row level security;
revoke all on public.start_drafts from public,anon,authenticated;
grant all on public.start_drafts to service_role;
create function public.restart_source_for_user(p_user uuid,p_kind text,p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare parent uuid; question text; s public.thought_sessions; b public.branch_questions;
begin
 if p_kind='node' then
  select session_id into parent from public.question_nodes where id=p_id;
 elsif p_kind='session' then
  parent=p_id;
 elsif p_kind='branch' then
  select * into b from public.branch_questions where id=p_id and user_id=p_user;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;
  parent=b.source_session_id;
 else raise exception 'SESSION_NOT_FOUND'; end if;
 if parent is not null then
  select * into s from public.thought_sessions where id=parent and user_id=p_user for share;
 end if;
 if p_kind in ('node','session') then
  if s.id is null or s.status<>'COMPLETED' or s.storage_state<>'SAVED' then raise exception 'SESSION_NOT_FOUND'; end if;
  if p_kind='node' then select final_text into question from public.question_nodes where id=p_id and session_id=parent;
  else
   if exists(select 1 from public.question_nodes where session_id=parent) then raise exception 'SESSION_NOT_FOUND'; end if;
   select content into question from public.messages where session_id=parent and kind='RAW_THOUGHT' and role='USER';
  end if;
 else
  select * into b from public.branch_questions where id=p_id and user_id=p_user for share;
  if not found or (b.retention_state<>'KEPT' and
   (s.id is null or s.status<>'ACTIVE' or s.storage_state<>'TEMPORARY' or s.temporary_expires_at<=now())) then raise exception 'SESSION_NOT_FOUND'; end if;
  question=b.text;
 end if;
 if question is null then raise exception 'SESSION_NOT_FOUND'; end if;
 return jsonb_build_object('question',question,'sourceSessionId',parent);
end $$;
revoke all on function public.restart_source_for_user(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.restart_source_for_user(uuid,text,uuid) to service_role;
create function public.read_restart_source(p_kind text,p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
 return public.restart_source_for_user(auth.uid(),p_kind,p_id);
end $$;
revoke all on function public.read_restart_source(text,uuid) from public,anon;
grant execute on function public.read_restart_source(text,uuid) to authenticated;
create function public.commit_start_with_recovery(
 p_user uuid,p_request uuid,p_token uuid,p_fingerprint text,p_session uuid,p_message uuid,p_text text,p_behavior text,
 p_label public.safety_label,p_category public.safety_category,p_source_message uuid,p_expires_at timestamptz,
 p_result jsonb,p_origin_kind text,p_origin_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare owner jsonb; origin jsonb;
begin
 perform 1 from public.ai_request_limits where user_id=p_user for update;
 if (p_origin_kind is null)<>(p_origin_id is null) or (p_source_message is not null and p_origin_id is not null) then raise exception 'START_SOURCE_INVALID'; end if;
 if p_origin_id is not null then origin=public.restart_source_for_user(p_user,p_origin_kind,p_origin_id); end if;
 owner=public.commit_start_input(p_user,p_request,p_token,p_fingerprint,p_session,p_message,p_text,p_behavior,p_label,p_category,p_source_message,p_expires_at);
 if p_behavior='CONTINUE' then
  if p_result is null or length(p_result::text)>32000 or p_result->>'kind' is null then raise exception 'START_RESULT_INVALID'; end if;
  insert into public.start_drafts(session_id,message_id,result) values(p_session,(owner->>'messageId')::uuid,p_result)
   on conflict(session_id) do update set result=excluded.result,message_id=excluded.message_id;
 else delete from public.start_drafts where session_id=p_session; end if;
 if origin is not null then
  insert into public.session_origins(session_id,source_session_id,source_node_id,source_branch_id)
  values(p_session,(origin->>'sourceSessionId')::uuid,case when p_origin_kind='node' then p_origin_id end,case when p_origin_kind='branch' then p_origin_id end);
 end if;
 return owner;
end $$;
revoke all on function public.commit_start_with_recovery(uuid,uuid,uuid,text,uuid,uuid,text,text,public.safety_label,public.safety_category,uuid,timestamptz,jsonb,text,uuid) from public,anon,authenticated;
grant execute on function public.commit_start_with_recovery(uuid,uuid,uuid,text,uuid,uuid,text,text,public.safety_label,public.safety_category,uuid,timestamptz,jsonb,text,uuid) to service_role;
create function public.list_recoverable_sessions(p_limit integer default 3,p_offset integer default 0) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
 if p_limit is null or p_offset is null or p_limit not between 1 and 50 or p_offset not between 0 and 10000 then raise exception 'INVALID_QUERY'; end if;
 perform public.settle_retention_for_user(auth.uid());
 select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) into result from (
  select s.id,s.status,s.temporary_expires_at as "expiresAt",n.id as "nodeId",
   left(coalesce(n.final_text,m.content,'아직 정하지 않은 질문'),160) as question
  from public.thought_sessions s
  left join lateral(select q.id,q.final_text from public.question_nodes q join public.segments g on g.id=q.segment_id where q.session_id=s.id order by g.ordinal desc,q.ordinal desc limit 1) n on true
  left join lateral(select content from public.messages where session_id=s.id and role='USER' and kind='RAW_THOUGHT' order by sequence_no limit 1) m on true
  where s.user_id=auth.uid() and s.status in ('ACTIVE','COMPLETED') and s.storage_state='TEMPORARY' and s.temporary_expires_at>now()
  order by s.last_activity_at desc,s.id limit p_limit+1 offset p_offset
 ) r;
 return result;
end $$;
revoke all on function public.list_recoverable_sessions(integer,integer) from public,anon;
grant execute on function public.list_recoverable_sessions(integer,integer) to authenticated;
create or replace function public.commit_conversation_step(
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
   if j->>'action' is distinct from (case when kind='REFLECT' then 'REFLECT' when kind='SHIFT' then 'SHIFT' when kind='CLOSE' then 'CLOSE' else null end) then raise exception 'CONVERSATION_JUDGE_INVALID'; end if;
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
  update public.thought_sessions set status='COMPLETED',completed_at=now() where id=p_session;
 end if;
 update public.conversation_runtime set version=version+1,last_request=p_request where session_id=p_session returning * into st;
 result=jsonb_build_object('version',st.version,'mode',st.mode);
 if st.mode in ('STOP','HANDOFF') then result=result||jsonb_build_object('category',p_payload->>'category','label',p_payload->>'label'); end if;
 insert into public.conversation_receipts(user_id,request_id,session_id,result) values(p_user,p_request,p_session,result);
 if not public.finish_ai_request(p_user,p_request,p_token,true,p_session) then raise exception 'CONVERSATION_LEASE_EXPIRED'; end if;
 return result;
end $$;

create or replace function public.complete_thought_session(target_session_id uuid)
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

  if v_session.status <> 'ACTIVE'
    or v_session.storage_state <> 'TEMPORARY' or v_session.temporary_expires_at<=now() then
    raise exception 'SESSION_NOT_COMPLETABLE';
  end if;

  update public.segments
  set status = 'CLOSED',
      closed_at = now()
  where session_id = target_session_id
    and status = 'ACTIVE';

  update public.thought_sessions
  set status = 'COMPLETED',
      completed_at = now()
  where id = target_session_id
  returning * into v_session;

  return v_session;
end;
$$;


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
      retention_source='USER',
      retention_decided_at = now(),
      trashed_at = now(),
      purge_after = now() + interval '7 days',
      temporary_expires_at = null
  where id = target_session_id
    and user_id = v_user_id
    and status = 'COMPLETED'
    and storage_state = 'SAVED'
  returning * into v_session;

  if v_session.id is null then
    raise exception 'SAVED_SESSION_NOT_FOUND';
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
      temporary_expires_at = null
  where id = target_session_id
    and user_id = v_user_id
    and status = 'COMPLETED'
    and storage_state = 'TRASHED'
    and purge_after > now()
  returning * into v_session;

  if v_session.id is null then
    raise exception 'RESTORABLE_SESSION_NOT_FOUND';
  end if;

  return v_session;
end;
$$;


commit;
