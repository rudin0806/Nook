begin;
-- Server-only commit. No raw text is passed to this function for STOP.
create function public.commit_start_input(
  p_user uuid, p_request uuid, p_token uuid, p_fingerprint text,
  p_session uuid, p_message uuid, p_text text, p_behavior text,
  p_label public.safety_label, p_category public.safety_category,
  p_source_message uuid default null, p_expires_at timestamptz default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  r public.ai_requests%rowtype;
  s public.thought_sessions%rowtype;
  g public.segments%rowtype;
  seq integer;
begin
  if p_user is null or p_request is null or p_token is null or p_session is null or p_message is null
    or p_fingerprint is null or p_fingerprint !~ '^[0-9a-f]{64}$'
    or p_behavior is null or p_behavior not in ('CONTINUE','STOP','HANDOFF')
    or p_label is null or p_category is null then raise exception 'START_INPUT_INVALID'; end if;
  if (p_behavior='STOP' and p_text is not null)
    or (p_behavior<>'STOP' and (p_text is null or length(btrim(p_text)) not between 1 and 5000))
    or (p_behavior='CONTINUE' and (p_label<>'NONE' or p_category<>'NONE'))
    or (p_behavior='HANDOFF' and (p_label<>'NONE' or p_category='NONE'))
    or (p_behavior='STOP' and (p_label='NONE' or p_category='NONE')) then raise exception 'START_SAFETY_INVALID'; end if;
  perform 1 from public.ai_request_limits where user_id=p_user for update;
  select * into r from public.ai_requests where user_id=p_user and request_id=p_request;
  if not found or r.token<>p_token or r.fingerprint<>p_fingerprint or r.state<>'RUNNING'
    or r.deadline<=clock_timestamp() then raise exception 'START_REQUEST_INVALID'; end if;
  if p_source_message is null then
    insert into public.thought_sessions(id,user_id) values(p_session,p_user);
    insert into public.segments(session_id,ordinal) values(p_session,1) returning * into g;
  else
    select * into s from public.thought_sessions where id=p_session and user_id=p_user for update;
    if not found or s.status<>'ACTIVE' or s.storage_state<>'TEMPORARY'
      or s.temporary_expires_at<=clock_timestamp() or p_expires_at is null
      or p_expires_at<=clock_timestamp() then raise exception 'START_SESSION_INVALID'; end if;
    select * into g from public.segments where session_id=p_session and ordinal=1 for update;
    if not found or g.status<>'ACTIVE' or g.node_count<>0 then raise exception 'START_ALREADY_APPROVED'; end if;
    if not exists(select 1 from public.messages where id=p_source_message and session_id=p_session
      and segment_id=g.id and role='USER' and kind='RAW_THOUGHT')
      or exists(select 1 from public.messages where session_id=p_session and role='USER' and kind='USER_REPLY') then
      raise exception 'START_SOURCE_INVALID_OR_ALREADY_SELECTED'; end if;
  end if;
  if p_behavior<>'STOP' then
    select coalesce(max(sequence_no),0)+1 into seq from public.messages where session_id=p_session;
    insert into public.messages(id,session_id,segment_id,role,kind,content,sequence_no,user_turn_no)
      values(p_message,p_session,g.id,'USER',case when p_source_message is null then 'RAW_THOUGHT'::public.message_kind else 'USER_REPLY'::public.message_kind end,
        p_text,seq,g.turn_count+1);
  end if;
  if p_behavior<>'CONTINUE' then
    perform public.record_safety_termination(p_session,p_label,p_category,p_behavior::public.safety_behavior,'CLASSIFIER');
  end if;
  if (p_source_message is not null and p_expires_at<=clock_timestamp())
    or not public.finish_ai_request(p_user,p_request,p_token,true,p_session) then raise exception 'START_REQUEST_EXPIRED'; end if;
  select * into s from public.thought_sessions where id=p_session;
  return jsonb_build_object('userId',p_user,'sessionId',p_session,
    'messageId',coalesce(p_source_message,p_message),
    'expiresAt',floor(extract(epoch from s.temporary_expires_at)*1000));
end $$;
revoke all on function public.commit_start_input(uuid,uuid,uuid,text,uuid,uuid,text,text,public.safety_label,public.safety_category,uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.commit_start_input(uuid,uuid,uuid,text,uuid,uuid,text,text,public.safety_label,public.safety_category,uuid,timestamptz) to service_role;

-- Approval edits use the same lease and close the session atomically on Safety termination.
create function public.terminate_start_approval(
  p_user uuid,p_request uuid,p_token uuid,p_fingerprint text,p_session uuid,p_source uuid,
  p_text text,p_label public.safety_label,p_category public.safety_category,p_behavior public.safety_behavior,p_expires_at timestamptz
) returns uuid language plpgsql security definer set search_path='' as $$
declare r public.ai_requests%rowtype; s public.thought_sessions%rowtype; g public.segments%rowtype; seq integer;
begin
  if p_user is null or p_request is null or p_token is null or p_fingerprint is null or p_session is null or p_source is null
    or p_expires_at is null or p_expires_at<=clock_timestamp() or p_behavior is null
    or p_label is null or p_category is null or (p_behavior='STOP' and p_text is not null)
    or (p_behavior='HANDOFF' and (p_text is null or length(btrim(p_text)) not between 1 and 5000)) then raise exception 'APPROVAL_INPUT_INVALID'; end if;
  perform 1 from public.ai_request_limits where user_id=p_user for update;
  select * into r from public.ai_requests where user_id=p_user and request_id=p_request;
  if not found or r.token<>p_token or r.fingerprint<>p_fingerprint or r.state<>'RUNNING' or r.deadline<=clock_timestamp() then raise exception 'APPROVAL_REQUEST_INVALID'; end if;
  select * into s from public.thought_sessions where id=p_session and user_id=p_user for update;
  if not found or s.status<>'ACTIVE' or s.storage_state<>'TEMPORARY' or s.temporary_expires_at<=clock_timestamp() then raise exception 'APPROVAL_SESSION_INVALID'; end if;
  select * into g from public.segments where session_id=p_session and ordinal=1 for update;
  if not found or g.status<>'ACTIVE' or g.node_count<>0 or not exists(select 1 from public.messages where id=p_source and session_id=p_session and kind='RAW_THOUGHT' and role='USER') then raise exception 'APPROVAL_SOURCE_INVALID'; end if;
  if p_behavior='HANDOFF' then
    select coalesce(max(sequence_no),0)+1 into seq from public.messages where session_id=p_session;
    insert into public.messages(session_id,segment_id,role,kind,content,sequence_no,user_turn_no)
      values(p_session,g.id,'USER','USER_REPLY',p_text,seq,g.turn_count+1);
  end if;
  perform public.record_safety_termination(p_session,p_label,p_category,p_behavior,'CLASSIFIER');
  if p_expires_at<=clock_timestamp() or not public.finish_ai_request(p_user,p_request,p_token,true,p_session) then raise exception 'APPROVAL_REQUEST_EXPIRED'; end if;
  return p_session;
end $$;
revoke all on function public.terminate_start_approval(uuid,uuid,uuid,text,uuid,uuid,text,public.safety_label,public.safety_category,public.safety_behavior,timestamptz) from public,anon,authenticated;
grant execute on function public.terminate_start_approval(uuid,uuid,uuid,text,uuid,uuid,text,public.safety_label,public.safety_category,public.safety_behavior,timestamptz) to service_role;
commit;
