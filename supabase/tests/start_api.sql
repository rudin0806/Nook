begin;
do $$
declare
 u uuid:=gen_random_uuid(); other_u uuid:=gen_random_uuid();
 req uuid; lease uuid; s uuid; m uuid; value jsonb; next_req uuid; next_lease uuid;
 fp text:=repeat('a',64); rejected boolean;
begin
 insert into auth.users(id) values(u),(other_u);
 -- STOP: no raw Message, no Node, terminal event and committed request.
 req:=gen_random_uuid();s:=gen_random_uuid();m:=gen_random_uuid();
 value:=public.claim_ai_request(u,req,fp);lease:=(value->>'token')::uuid;
 perform public.commit_start_input(u,req,lease,fp,s,m,null,'STOP','HIGH_RISK','SUICIDE_SELF_HARM');
 if exists(select 1 from public.messages where session_id=s) or exists(select 1 from public.question_nodes where session_id=s)
   or not exists(select 1 from public.thought_sessions where id=s and status='SAFETY_STOPPED') then raise exception 'STOP_PERSISTENCE_FAILED'; end if;
 if (public.claim_ai_request(u,req,fp)->>'status')<>'SUCCEEDED' then raise exception 'REPLAY_FAILED';end if;
 -- HANDOFF: raw Message retained, then session closed, no Node.
 req:=gen_random_uuid();s:=gen_random_uuid();m:=gen_random_uuid();
 lease:=(public.claim_ai_request(u,req,fp)->>'token')::uuid;
 perform public.commit_start_input(u,req,lease,fp,s,m,'도움을 찾고 있어요','HANDOFF','NONE','GENERAL_MENTAL_HEALTH');
 if (select count(*) from public.messages where session_id=s)<>1
   or not exists(select 1 from public.thought_sessions where id=s and status='HANDOFF_STOPPED') then raise exception 'HANDOFF_PERSISTENCE_FAILED';end if;
 -- Continue does not create any unapproved Node.
 req:=gen_random_uuid();s:=gen_random_uuid();m:=gen_random_uuid();
 lease:=(public.claim_ai_request(u,req,fp)->>'token')::uuid;
 perform public.commit_start_input(u,req,lease,fp,s,m,'직장과 이사 사이에서 고민해요','CONTINUE','NONE','NONE');
 if exists(select 1 from public.question_nodes where session_id=s) or (select turn_count from public.segments where session_id=s)<>1 then raise exception 'UNAPPROVED_NODE_OR_COUNT';end if;
 -- Another actor cannot append a selected focus to this Session.
 next_req:=gen_random_uuid();next_lease:=(public.claim_ai_request(other_u,next_req,fp)->>'token')::uuid;
 rejected:=false;
 begin
  perform public.commit_start_input(other_u,next_req,next_lease,fp,s,gen_random_uuid(),'이사','CONTINUE','NONE','NONE',m,now()+interval '1 hour');
 exception when others then rejected:=true;end;
 if not rejected then raise exception 'CROSS_OWNER_ACCEPTED';end if;
 perform public.finish_ai_request(other_u,next_req,next_lease,false,null);
 -- Select a focus once; a different request cannot change the already selected focus.
 next_req:=gen_random_uuid();next_lease:=(public.claim_ai_request(u,next_req,fp)->>'token')::uuid;
 perform public.commit_start_input(u,next_req,next_lease,fp,s,gen_random_uuid(),'이사','CONTINUE','NONE','NONE',m,now()+interval '1 hour');
 next_req:=gen_random_uuid();next_lease:=(public.claim_ai_request(u,next_req,fp)->>'token')::uuid;
 rejected:=false;
 begin
  perform public.commit_start_input(u,next_req,next_lease,fp,s,gen_random_uuid(),'직장','CONTINUE','NONE','NONE',m,now()+interval '1 hour');
 exception when others then rejected:=true;end;
 if not rejected or (select turn_count from public.segments where session_id=s)<>2 then raise exception 'FOCUS_DUPLICATED';end if;
 perform public.finish_ai_request(u,next_req,next_lease,false,null);
 -- Reset only this isolated test user's counters.
 update public.ai_request_limits set minute_count=0 where user_id=u;
 -- Edited approval STOP keeps existing safe Messages, adds no dangerous edit or Node.
 req:=gen_random_uuid();lease:=(public.claim_ai_request(u,req,fp)->>'token')::uuid;
 perform public.terminate_start_approval(u,req,lease,fp,s,m,null,'HIGH_RISK','SUICIDE_SELF_HARM','STOP',now()+interval '1 hour');
 if (select count(*) from public.messages where session_id=s)<>2 or exists(select 1 from public.question_nodes where session_id=s)
   or not exists(select 1 from public.safety_events where session_id=s and behavior='STOP') then raise exception 'EDIT_STOP_FAILED';end if;
 -- Expired lease cannot leave a partial Session or Message.
 req:=gen_random_uuid();s:=gen_random_uuid();lease:=(public.claim_ai_request(u,req,fp)->>'token')::uuid;
 update public.ai_requests set deadline=clock_timestamp()-interval '1 second' where user_id=u and request_id=req;
 rejected:=false;
 begin
  perform public.commit_start_input(u,req,lease,fp,s,gen_random_uuid(),'안전한 입력','CONTINUE','NONE','NONE');
 exception when others then rejected:=true;end;
 if not rejected or exists(select 1 from public.thought_sessions where id=s) then raise exception 'EXPIRED_LEASE_WRITES';end if;
 -- RPCs are not public APIs, even for signed-in clients.
 if has_function_privilege('anon','public.commit_start_input(uuid,uuid,uuid,text,uuid,uuid,text,text,public.safety_label,public.safety_category,uuid,timestamptz)','EXECUTE')
 or has_function_privilege('authenticated','public.commit_start_input(uuid,uuid,uuid,text,uuid,uuid,text,text,public.safety_label,public.safety_category,uuid,timestamptz)','EXECUTE')
 or has_function_privilege('authenticated','public.terminate_start_approval(uuid,uuid,uuid,text,uuid,uuid,text,public.safety_label,public.safety_category,public.safety_behavior,timestamptz)','EXECUTE') then raise exception 'PUBLIC_RPC_EXECUTE';end if;
end $$;
rollback;
