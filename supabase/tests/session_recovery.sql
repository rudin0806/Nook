-- Synthetic fixtures only. Rollback prevents test data from persisting.
begin;
do $$
declare
 u uuid:=gen_random_uuid(); other_u uuid:=gen_random_uuid(); anon_u uuid:=gen_random_uuid();
 s uuid:=gen_random_uuid(); g uuid:=gen_random_uuid(); n uuid:=gen_random_uuid(); branch uuid:=gen_random_uuid();
 child uuid:=gen_random_uuid(); child2 uuid:=gen_random_uuid(); req uuid; token uuid; msg uuid;
 expired uuid:=gen_random_uuid(); ancient uuid:=gen_random_uuid(); anon_s uuid:=gen_random_uuid(); safety_s uuid:=gen_random_uuid();
 fp text:=repeat('a',64); ttl timestamptz; result jsonb; count_before integer;
begin
 insert into auth.users(id,is_anonymous) values(u,false),(other_u,false),(anon_u,true);
 insert into public.thought_sessions(id,user_id) values(s,u);
 insert into public.segments(id,session_id,ordinal) values(g,s,1);
 insert into public.messages(session_id,segment_id,role,kind,content,sequence_no,user_turn_no) values(s,g,'USER','RAW_THOUGHT','어떤 일을 하고 싶을까?',1,1);
 insert into public.question_nodes(id,session_id,segment_id,ordinal,kind,ai_proposed_text,final_text,approved_at) values(n,s,g,1,'START','어떤 일을 하고 싶을까?','어떤 일을 하고 싶을까?',now());
 insert into public.branch_questions(id,user_id,source_session_id,source_segment_id,source_node_id,text) values(branch,u,s,g,n,'어디서 살고 싶을까?');
 select temporary_expires_at into ttl from public.thought_sessions where id=s;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'is_anonymous',false)::text,true);
 result=public.read_restart_source('branch',branch);
 if result->>'question'<>'어디서 살고 싶을까?' then raise exception 'SOURCE_TEXT_LOST'; end if;
 -- Reading a different topic creates no session, approves no Node and extends no deadline.
 if (select count(*) from public.thought_sessions where user_id=u)<>1 or (select temporary_expires_at from public.thought_sessions where id=s)<>ttl then raise exception 'READ_HAS_WRITE_EFFECT'; end if;
 begin perform public.restart_source_for_user(other_u,'branch',branch);raise exception 'CROSS_OWNER_SOURCE';exception when others then if sqlerrm<>'SESSION_NOT_FOUND' then raise;end if;end;
 -- New topic shares only provenance; its original remains active and recoverable.
 req=gen_random_uuid();token=(public.claim_ai_request(u,req,fp)->>'token')::uuid;msg=gen_random_uuid();
 perform public.commit_start_with_recovery(u,req,token,fp,child,msg,'어디서 살고 싶을까?','CONTINUE','NONE','NONE',null,null,'{"kind":"CLEAR_AS_IS","question":"어디서 살고 싶을까?"}','branch',branch);
 if not exists(select 1 from public.session_origins where session_id=child and source_session_id=s and source_branch_id=branch) then raise exception 'ORIGIN_MISSING'; end if;
 if (select status from public.thought_sessions where id=s)<>'ACTIVE' or (select temporary_expires_at from public.thought_sessions where id=s)<>ttl then raise exception 'PARENT_CHANGED'; end if;
 if not exists(select 1 from public.start_drafts where session_id=child and message_id=msg) or exists(select 1 from public.question_nodes where session_id=child) then raise exception 'DRAFT_NOT_PERSISTED_OR_PREAPPROVED'; end if;
 result=public.list_recoverable_sessions(3,0);
 if jsonb_array_length(result)<>2 then raise exception 'RECOVERY_OVERWROTE_SESSION'; end if;
 if (select temporary_expires_at from public.thought_sessions where id=s)<>ttl then raise exception 'RECOVERY_EXTENDED_DEADLINE';end if;
 if has_table_privilege('authenticated','public.start_drafts','select') or has_function_privilege('authenticated','public.restart_source_for_user(uuid,text,uuid)','execute') then raise exception 'PRIVATE_DATA_EXPOSED';end if;
 -- In-flight normal output cannot append after explicit exit. No model/lease needed for exit.
 req=gen_random_uuid();token=(public.claim_ai_request(u,req,fp)->>'token')::uuid;
 perform public.commit_conversation_step(u,req,token,fp,s,0,'input','일하는 시간을 바꾸고 싶어','{}');
 perform public.finalize_session_retention(s,true,'{}');
 if not exists(select 1 from public.thought_sessions where id=s and status='COMPLETED' and storage_state='SAVED') then raise exception 'ACTIVE_SAVE_FAILED';end if;
 if exists(select 1 from public.branch_questions where id=branch) or not exists(select 1 from public.session_origins where session_id=child and source_branch_id is null and source_session_id=s) then raise exception 'BRANCH_INDEPENDENCE_FAILED'; end if;
 begin perform public.commit_conversation_step(u,req,token,fp,s,1,'output',null,'{"kind":"CLOSE"}');raise exception 'LATE_OUTPUT_ACCEPTED';exception when others then if sqlerrm<>'CONVERSATION_SESSION_INVALID' then raise;end if;end;
 perform public.finish_ai_request(u,req,token,false,null);
 perform public.finalize_session_retention(s,true,'{}'); -- same decision replay
 begin perform public.finalize_session_retention(s,false,'{}');raise exception 'CONFLICTING_SAVE_ACCEPTED';exception when others then if sqlerrm<>'SESSION_RETENTION_ALREADY_DECIDED' then raise;end if;end;
 -- A saved Node can start repeatedly, without changing its historical text.
 req=gen_random_uuid();token=(public.claim_ai_request(u,req,fp)->>'token')::uuid;
 perform public.commit_start_with_recovery(u,req,token,fp,child2,gen_random_uuid(),'어떤 일을 하고 싶을까?','CONTINUE','NONE','NONE',null,null,'{"kind":"CLEAR_AS_IS","question":"어떤 일을 하고 싶을까?"}','node',n);
 if not exists(select 1 from public.session_origins where session_id=child2 and source_node_id=n) then raise exception 'SAVED_NODE_RESTART_MISSING'; end if;
 if (select final_text from public.question_nodes where id=n)<>'어떤 일을 하고 싶을까?' then raise exception 'HISTORICAL_NODE_CHANGED';end if;
 -- Before-approval saving preserves raw input but never invents a confirmed Node.
 perform public.finalize_session_retention(child,true,'{}');
 if (public.read_restart_source('session',child)->>'question')<>'어디서 살고 싶을까?' then raise exception 'RAW_ONLY_SAVE_RESTART_FAILED';end if;
 -- Expiry is anchored to the deadline, even if maintenance is two days late.
 insert into public.thought_sessions(id,user_id,temporary_expires_at) values(expired,u,now()-interval '2 days'),(ancient,u,now()-interval '8 days'),(anon_s,anon_u,now());
 insert into public.thought_sessions(id,user_id,status,completed_at,temporary_expires_at) values(safety_s,u,'SAFETY_STOPPED',now(),now());
 perform public.settle_own_retention();
 if not exists(select 1 from public.thought_sessions where id=expired and storage_state='TRASHED' and trashed_at=now()-interval '2 days' and purge_after=now()+interval '5 days') then raise exception 'EXPIRY_DRIFT';end if;
 if exists(select 1 from public.thought_sessions where id in(ancient,safety_s)) or not exists(select 1 from public.thought_sessions where id=anon_s) then raise exception 'OWNER_SETTLEMENT_SCOPE';end if;
 if public.can_view_session(anon_s) then raise exception 'CROSS_OWNER_VISIBLE';end if;
 perform public.restore_session_from_trash(expired);
 if not exists(select 1 from public.thought_sessions where id=expired and storage_state='SAVED') then raise exception 'EXPIRED_RESTORE_FAILED';end if;
 perform public.settle_retention_for_user(anon_u);
 if exists(select 1 from public.thought_sessions where id=anon_s) then raise exception 'ANONYMOUS_EXCEPTION_CHANGED';end if;
 -- Physical removal of original does not cascade into restarted sessions or their input.
 delete from public.thought_sessions where id=s;
 if not exists(select 1 from public.thought_sessions where id=child2) or not exists(select 1 from public.session_origins where session_id=child2 and source_session_id is null and source_node_id is null) then raise exception 'RESTART_CASCADED';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',other_u,'is_anonymous',false)::text,true);
 if jsonb_array_length(public.list_recoverable_sessions(3,0))<>0 then raise exception 'CROSS_OWNER_RECOVERY';end if;
 set constraints all immediate;
end $$;
rollback;
