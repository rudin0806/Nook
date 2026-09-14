-- Isolated fixture only. Every change, including fault-injection triggers, is rolled back.
begin;
create function public.test_expire_approval_lease() returns trigger language plpgsql as $$
begin
  if current_setting('nook.test_expire',true) = 'yes' then
    update public.ai_requests set deadline=clock_timestamp()-interval '1 second'
      where user_id=(select user_id from public.thought_sessions where id=new.session_id) and state='RUNNING';
  end if;
  return new;
end $$;
create trigger test_expire_approval after insert on public.question_nodes
for each row execute function public.test_expire_approval_lease();

do $$
declare
  u uuid:=gen_random_uuid(); other_user uuid:=gen_random_uuid(); s uuid:=gen_random_uuid();
  g uuid:=gen_random_uuid(); m uuid:=gen_random_uuid(); req uuid:=gen_random_uuid();
  lease uuid; node_id uuid; again uuid; n integer; fp text:=repeat('b',64);
  expiry timestamptz:=clock_timestamp()+interval '1 hour';
  fn text:='public.approve_start_question(uuid,uuid,uuid,text,uuid,uuid,text,text,timestamptz)';
begin
  if has_function_privilege('anon',fn,'EXECUTE') or has_function_privilege('authenticated',fn,'EXECUTE')
    or not has_function_privilege('service_role',fn,'EXECUTE') then raise exception 'FAIL RPC grants'; end if;
  insert into auth.users(id) values(u),(other_user);
  insert into public.thought_sessions(id,user_id) values(s,u);
  insert into public.segments(id,session_id,ordinal) values(g,s,1);
  insert into public.messages(id,session_id,segment_id,role,kind,content,sequence_no,user_turn_no)
    values(m,s,g,'USER','RAW_THOUGHT','회사를 옮길까?',1,1);
  if exists(select 1 from public.question_nodes where session_id=s) then raise exception 'FAIL unapproved node'; end if;
  lease:=(public.claim_ai_request(u,req,fp)->>'token')::uuid;

  begin
    perform public.approve_start_question(other_user,req,lease,fp,s,m,'회사를 옮길까?','회사를 옮길까?',expiry);
    raise exception 'FAIL wrong user';
  exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; end;
  begin
    perform public.approve_start_question(u,req,gen_random_uuid(),fp,s,m,'회사를 옮길까?','회사를 옮길까?',expiry);
    raise exception 'FAIL wrong token';
  exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; end;
  begin
    perform public.approve_start_question(u,req,lease,repeat('c',64),s,m,'회사를 옮길까?','회사를 옮길까?',expiry);
    raise exception 'FAIL wrong fingerprint';
  exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; end;
  begin
    perform public.approve_start_question(u,req,lease,fp,s,m,'회사를 옮길까?','회사를 옮길까?',clock_timestamp());
    raise exception 'FAIL expired receipt';
  exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; end;
  begin
    perform public.approve_start_question(u,req,lease,fp,s,gen_random_uuid(),'회사를 옮길까?','회사를 옮길까?',expiry);
    raise exception 'FAIL wrong source';
  exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; end;

  -- Failure AFTER insertion must revert the Node, counter and request completion together.
  perform set_config('nook.test_expire','yes',true);
  begin
    perform public.approve_start_question(u,req,lease,fp,s,m,'회사를 옮길까?','회사를 옮길까?',expiry);
    raise exception 'FAIL expiry after insert';
  exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; end;
  perform set_config('nook.test_expire','no',true);
  if exists(select 1 from public.question_nodes where session_id=s)
    or (select node_count from public.segments where id=g)<>0
    or (select state from public.ai_requests where user_id=u and request_id=req)<>'RUNNING' then
    raise exception 'FAIL atomic rollback';
  end if;

  set local role service_role;
  node_id:=public.approve_start_question(u,req,lease,fp,s,m,'회사를 옮길까?','다른 일을 해볼까?',expiry);
  again:=public.approve_start_question(u,req,lease,fp,s,m,'회사를 옮길까?','다른 일을 해볼까?',expiry);
  reset role;
  if node_id<>again or (select count(*) from public.question_nodes where session_id=s)<>1
    or (select node_count from public.segments where id=g)<>1
    or (select turn_count from public.segments where id=g)<>1
    or (select state from public.ai_requests where user_id=u and request_id=req)<>'SUCCEEDED'
    or (select result_id from public.ai_requests where user_id=u and request_id=req)<>node_id then
    raise exception 'FAIL success/replay/counter';
  end if;
  if public.finish_ai_request(u,req,lease,false,null) then raise exception 'FAIL late failure overwrote success'; end if;

  req:=gen_random_uuid(); lease:=(public.claim_ai_request(u,req,fp)->>'token')::uuid;
  begin
    perform public.approve_start_question(u,req,lease,fp,s,m,'회사를 옮길까?','다른 질문?',expiry);
    raise exception 'FAIL second request created second START';
  exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; end;

  -- Actual authenticated SELECT sees only the owner's approved node.
  perform set_config('request.jwt.claims',jsonb_build_object('sub',other_user,'is_anonymous',false)::text,true);
  set local role authenticated;
  select count(*) into n from public.question_nodes where id=node_id;
  if n<>0 then raise exception 'FAIL cross-user RLS'; end if;
  reset role;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'is_anonymous',false)::text,true);
  set local role authenticated;
  select count(*) into n from public.question_nodes where id=node_id;
  if n<>1 then raise exception 'FAIL owner RLS'; end if;
  reset role;
end $$;
rollback;
