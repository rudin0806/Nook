begin;
do $$
declare
  owner_id uuid := gen_random_uuid();
  other_id uuid := gen_random_uuid();
  first_id uuid := gen_random_uuid();
  last_id uuid := gen_random_uuid();
  revision text;
  result jsonb;
begin
  insert into auth.users(id) values(owner_id),(other_id);
  insert into public.thought_sessions(id,user_id,status,storage_state,completed_at,retention_decided_at,temporary_expires_at,shelf_position)
  values(first_id,owner_id,'COMPLETED','SAVED',now(),now(),null,1),
        (last_id,owner_id,'COMPLETED','SAVED',now(),now(),null,2);
  perform set_config('request.jwt.claims',json_build_object('sub',owner_id,'is_anonymous',false)::text,true);
  set local role authenticated;
  select shelf_revision into revision from public.saved_thought_sessions where id=first_id;
  result := public.move_saved_session_checked(last_id,1,revision);
  if (result->>'position')::integer <> 1 or result->>'revision' = revision then raise exception 'FAIL acknowledgement'; end if;
  -- The second tab submits its old snapshot after the first transaction moved a book.
  begin
    perform public.move_saved_session_checked(first_id,1,revision);
    raise exception 'FAIL stale request accepted';
  exception when others then
    if sqlerrm <> 'SHELF_ORDER_STALE' then raise; end if;
  end;
  if (select shelf_position from public.saved_thought_sessions where id=last_id) <> 1 then raise exception 'FAIL stale request changed order'; end if;
  perform public.move_saved_session_checked(first_id,1,result->>'revision');
  perform set_config('request.jwt.claims',json_build_object('sub',other_id,'is_anonymous',false)::text,true);
  if exists(select 1 from public.saved_thought_sessions where id=first_id) then raise exception 'FAIL foreign shelf visible'; end if;
  begin
    perform public.move_saved_session_checked(first_id,1,public.own_shelf_revision());
    raise exception 'FAIL foreign move accepted';
  exception when others then
    if sqlerrm <> 'SAVED_SESSION_NOT_FOUND' then raise; end if;
  end;
  perform set_config('request.jwt.claims',json_build_object('sub',owner_id,'is_anonymous',true)::text,true);
  begin
    perform public.move_saved_session_checked(first_id,1,revision);
    raise exception 'FAIL anonymous move accepted';
  exception when others then
    if sqlerrm <> 'IDENTITY_LINK_REQUIRED' then raise; end if;
  end;
  reset role;
end;
$$;
rollback;
