begin;

-- Only trusted server code may supply the verified signed proposal and Safety-cleared edit.
-- Lock order matches claim/finish: user limits -> session -> segment.
create function public.approve_start_question(
  p_user uuid, p_request uuid, p_token uuid, p_fingerprint text,
  p_session uuid, p_message uuid, p_proposed text, p_final text,
  p_expires_at timestamptz
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  r public.ai_requests%rowtype;
  s public.thought_sessions%rowtype;
  segment_id uuid;
  node_id uuid;
begin
  if p_user is null or p_request is null or p_token is null
    or p_session is null or p_message is null or p_expires_at is null
    or p_fingerprint is null or p_fingerprint !~ '^[0-9a-f]{64}$'
    or p_proposed is null or length(btrim(p_proposed)) not between 1 and 5000
    or p_final is null or length(btrim(p_final)) not between 1 and 5000 then
    raise exception 'APPROVAL_INPUT_INVALID' using errcode='22023';
  end if;
  perform 1 from public.ai_request_limits where user_id=p_user for update;
  if not found then raise exception 'APPROVAL_REQUEST_INVALID'; end if;
  select * into r from public.ai_requests where user_id=p_user and request_id=p_request;
  if not found or r.token <> p_token or r.fingerprint <> p_fingerprint then
    raise exception 'APPROVAL_REQUEST_INVALID';
  end if;
  select * into s from public.thought_sessions where id=p_session and user_id=p_user for update;
  if not found then raise exception 'APPROVAL_SESSION_INVALID'; end if;
  if r.state = 'SUCCEEDED' then
    -- A lost-response retry can return only this exact committed Node.
    select id into node_id from public.question_nodes
      where id=r.result_id and session_id=p_session and kind='START'
        and ai_proposed_text=p_proposed and final_text=p_final;
    if node_id is null then raise exception 'APPROVAL_REQUEST_INVALID'; end if;
    return node_id;
  end if;
  if r.state <> 'RUNNING' or r.deadline <= clock_timestamp()
    or p_expires_at <= clock_timestamp() then raise exception 'APPROVAL_REQUEST_EXPIRED'; end if;
  if s.status <> 'ACTIVE' or s.storage_state <> 'TEMPORARY'
    or s.temporary_expires_at <= clock_timestamp() then raise exception 'APPROVAL_SESSION_INVALID'; end if;
  select g.id into segment_id from public.segments g
    join public.messages m on m.segment_id=g.id and m.session_id=g.session_id
    where g.session_id=p_session and g.ordinal=1 and g.status='ACTIVE' and g.node_count=0
      and m.id=p_message and m.role='USER' and m.kind='RAW_THOUGHT'
    for update of g;
  if segment_id is null or exists(select 1 from public.question_nodes where session_id=p_session) then
    raise exception 'APPROVAL_ALREADY_CONFIRMED_OR_INVALID';
  end if;
  insert into public.question_nodes(session_id,segment_id,ordinal,kind,ai_proposed_text,final_text,approved_at)
    values(p_session,segment_id,1,'START',p_proposed,p_final,clock_timestamp()) returning id into node_id;
  -- The existing insert trigger increments node_count. Never increment it twice here.
  -- Recheck lease and receipt after inserts/triggers; failure rolls EVERYTHING back.
  if p_expires_at <= clock_timestamp()
    or not public.finish_ai_request(p_user,p_request,p_token,true,node_id) then
    raise exception 'APPROVAL_REQUEST_EXPIRED';
  end if;
  return node_id;
end $$;
revoke all on function public.approve_start_question(uuid,uuid,uuid,text,uuid,uuid,text,text,timestamptz)
  from public,anon,authenticated;
grant execute on function public.approve_start_question(uuid,uuid,uuid,text,uuid,uuid,text,text,timestamptz)
  to service_role;

commit;
