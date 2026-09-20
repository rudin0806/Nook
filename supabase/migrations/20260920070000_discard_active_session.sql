-- 이어갈 대화를 사용자가 지금 휴지통으로 보낸다.
--
-- 새 상태를 만들 필요가 없었다. 24시간이 지난 이어갈 대화는 이미
-- `settle_retention_for_user`가 COMPLETED + TRASHED로 옮기고 7일 뒤에 지운다.
-- 사용자가 원한 것은 그 전환을 **지금 당기는 것**이므로, 같은 전환을 그대로 하되
-- retention_source만 EXPIRED가 아니라 USER로 남긴다. 그래서 휴지통 목록·복원·정산
-- 어느 쪽도 손댈 필요가 없다.
--
-- 계정을 연결하지 않은 사용자에게는 만료 경로가 세션을 지운다. 여기서도 같게 한다 —
-- 휴지통은 계정이 있어야 열리는 곳이라 넣어 두면 닿을 수 없는 곳에 남는다.
create function public.discard_active_session(target_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_session public.thought_sessions;
  v_anonymous boolean;
begin
  if v_user is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;

  select * into v_session from public.thought_sessions
   where id = target_session_id
     and user_id = v_user
     and status = 'ACTIVE'
     and storage_state = 'TEMPORARY'
   for update;
  if v_session.id is null then raise exception 'ACTIVE_SESSION_NOT_FOUND'; end if;

  select coalesce(is_anonymous, false) into v_anonymous from auth.users where id = v_user;
  if v_anonymous then
    delete from public.thought_sessions where id = v_session.id;
    return jsonb_build_object('sessionId', target_session_id, 'state', 'deleted');
  end if;

  -- 만료 경로와 같은 순서다. 대화를 먼저 닫아야 되살아나지 않는다.
  update public.segments set status = 'CLOSED', closed_at = coalesce(closed_at, now())
   where session_id = v_session.id and status = 'ACTIVE';
  update public.conversation_runtime
     set mode = 'FINISHED', pending = null, version = version + 1
   where session_id = v_session.id;
  update public.thought_sessions
     set status = 'COMPLETED',
         completed_at = coalesce(completed_at, now()),
         storage_state = 'TRASHED',
         retention_source = 'USER',
         retention_decided_at = now(),
         trashed_at = now(),
         purge_after = now() + interval '7 days',
         temporary_expires_at = null,
         shelf_position = null
   where id = v_session.id;

  return jsonb_build_object('sessionId', target_session_id, 'state', 'trashed');
end $$;
revoke all on function public.discard_active_session(uuid) from public, anon;
grant execute on function public.discard_active_session(uuid) to authenticated;
