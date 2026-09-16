-- A snapshot fingerprint is read in the same statement as the shelf page.
-- It contains only IDs/positions; it is a concurrency token, not an auth credential.
create function public.own_shelf_revision() returns text
language sql stable security invoker set search_path = '' as $$
  select md5(coalesce(string_agg(id::text || ':' || coalesce(shelf_position::text, 'null'), ',' order by id), ''))
  from public.thought_sessions
  where user_id = auth.uid() and status = 'COMPLETED' and storage_state = 'SAVED';
$$;
revoke all on function public.own_shelf_revision() from public, anon;
grant execute on function public.own_shelf_revision() to authenticated, service_role;

create or replace view public.saved_thought_sessions with (security_invoker = true) as
select id, user_id, origin_branch_id, started_at, completed_at, retention_decided_at, shelf_position,
  (select public.own_shelf_revision()) as shelf_revision
from public.thought_sessions where status = 'COMPLETED' and storage_state = 'SAVED';

create function public.move_saved_session_checked(p_session_id uuid, p_target_position integer, p_expected_revision text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_position integer;
begin
  if v_user is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then raise exception 'IDENTITY_LINK_REQUIRED'; end if;
  insert into public.ai_request_limits(user_id) values(v_user) on conflict do nothing;
  perform 1 from public.ai_request_limits where user_id = v_user for update;
  if p_expected_revision is null or p_expected_revision <> public.own_shelf_revision() then
    raise exception 'SHELF_ORDER_STALE';
  end if;
  v_position := public.move_saved_session(p_session_id, p_target_position);
  return jsonb_build_object('position', v_position, 'revision', public.own_shelf_revision());
end;
$$;
revoke all on function public.move_saved_session_checked(uuid, integer, text) from public, anon;
grant execute on function public.move_saved_session_checked(uuid, integer, text) to authenticated;

-- Legacy RPC removal is a separate post-deployment migration.
