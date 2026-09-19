-- 질문을 확정한 직후 대화 화면에는 사용자가 처음 적은 생각만 있고 누크의 말이 없다.
-- 물어 놓고 기다리게 하는 흐름이라, 그 자리에서 첫 되묻기를 서버가 만든다.
--
-- commit_conversation_step의 'output' 단계는 같은 요청이 앞서 'input'을 남겼을 것을
-- 요구한다(st.last_request = p_request). 첫 되묻기 요청은 새 발화를 받지 않으므로
-- 그 input이 없다.
--
-- 그 함수를 고치지 않는다. 본문을 제자리에서 기울 수 없어 400줄을 통째로 다시 적어야
-- 하는데, 바꿀 것은 검사 한 줄이고 나머지는 이미 검증된 코드다. 대신 이 작은 함수가
-- 'output'이 기대하는 자리만 미리 만들어 준다 — 조건을 스스로 확인한 뒤 last_request만
-- 옮긴다. version은 건드리지 않는다. 'input'과 달리 남길 발화가 없기 때문이다.
--
-- 문은 세션당 한 번만 열린다. ASSISTANT 발화가 하나라도 있으면 거절하므로, 이 경로로
-- 답을 두 번 만들어 낼 수 없다. 리스·소유권·상태 검사는 본 함수와 같은 것을 쓴다.
create or replace function public.begin_conversation_opening(
 p_user uuid, p_request uuid, p_token uuid, p_session uuid
) returns void language plpgsql security definer set search_path='' as $$
declare
 r public.ai_requests%rowtype; s public.thought_sessions%rowtype; st public.conversation_runtime%rowtype;
begin
 if p_user is null or p_request is null or p_token is null or p_session is null then
  raise exception 'CONVERSATION_INPUT_INVALID'; end if;
 perform 1 from public.ai_request_limits where user_id=p_user for update;
 select * into r from public.ai_requests where user_id=p_user and request_id=p_request;
 if not found or r.token is distinct from p_token or r.state<>'RUNNING' or r.deadline<=clock_timestamp() then
  raise exception 'CONVERSATION_LEASE_INVALID'; end if;
 select * into s from public.thought_sessions where id=p_session and user_id=p_user for update;
 if not found or s.status<>'ACTIVE' or s.storage_state<>'TEMPORARY' or s.temporary_expires_at<=clock_timestamp() then
  raise exception 'CONVERSATION_SESSION_INVALID'; end if;
 -- 첫 질문이 확정돼 있어야 한다. 노드 없이 되묻기를 만들 자리는 없다.
 if not exists(select 1 from public.question_nodes where session_id=p_session) then
  raise exception 'CONVERSATION_APPROVAL_REQUIRED'; end if;
 insert into public.conversation_runtime(session_id) values(p_session) on conflict do nothing;
 select * into st from public.conversation_runtime where session_id=p_session for update;
 if st.mode<>'READY' then raise exception 'CONVERSATION_OPEN_BLOCKED'; end if;
 if exists(select 1 from public.messages where session_id=p_session and role='ASSISTANT') then
  raise exception 'CONVERSATION_OPEN_BLOCKED'; end if;
 update public.conversation_runtime set last_request=p_request where session_id=p_session;
end $$;
revoke all on function public.begin_conversation_opening(uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.begin_conversation_opening(uuid,uuid,uuid,uuid) to service_role;
