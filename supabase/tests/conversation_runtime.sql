-- Synthetic fixtures only; the entire test is rolled back.
begin;
insert into auth.users(id) values ('90000000-0000-4000-8000-000000000001'),('90000000-0000-4000-8000-000000000002');
insert into public.thought_sessions(id,user_id) values
 ('91000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001'),
 ('91000000-0000-4000-8000-000000000002','90000000-0000-4000-8000-000000000002'),
 ('91000000-0000-4000-8000-000000000003','90000000-0000-4000-8000-000000000002');
insert into public.segments(id,session_id,ordinal) values
 ('92000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001',1),
 ('92000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000002',1),
 ('92000000-0000-4000-8000-000000000003','91000000-0000-4000-8000-000000000003',1);
insert into public.messages(id,session_id,segment_id,role,kind,content,sequence_no,user_turn_no) values
 ('93000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','USER','RAW_THOUGHT','이직할까?',1,1),
 ('93000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000002','USER','RAW_THOUGHT','남의 이야기',1,1),
 ('93000000-0000-4000-8000-000000000003','91000000-0000-4000-8000-000000000003','92000000-0000-4000-8000-000000000003','USER','RAW_THOUGHT','도움을 찾는 이야기',1,1);
insert into public.question_nodes(session_id,segment_id,ordinal,kind,ai_proposed_text,final_text,approved_at)
 select session_id,id,1,'START','이직할까?','이직할까?',now() from public.segments where id::text like '92000000%';

do $$
declare u uuid='90000000-0000-4000-8000-000000000001'; s uuid='91000000-0000-4000-8000-000000000001';
 req uuid; tok uuid; res jsonb; m uuid; newnode uuid; saved integer; b uuid='90000000-0000-4000-8000-000000000002';
 j jsonb='{"action":"SHIFT","shift_confidence":"HIGH","medium_reason":null,"evidence_turns":["U2"],"clarifications":[],"branches":[],"invalidate_clarifications":[],"promote_pile_item":null}';
 meta jsonb='{"configuredModel":"test-model","promptVersion":"test-v1","latencyMs":0,"inputTokens":null,"outputTokens":null}';
begin
 if has_function_privilege('authenticated','public.commit_conversation_step(uuid,uuid,uuid,text,uuid,integer,text,text,jsonb)','execute') or has_function_privilege('anon','public.commit_conversation_step(uuid,uuid,uuid,text,uuid,integer,text,text,jsonb)','execute') then raise exception 'RPC_EXPOSED'; end if;
 if has_table_privilege('authenticated','public.conversation_runtime','insert') or has_table_privilege('authenticated','public.conversation_receipts','select') then raise exception 'STATE_EXPOSED'; end if;
 req=gen_random_uuid();tok=(public.claim_ai_request(u,req,repeat('a',64))->>'token')::uuid;
 begin
  perform public.commit_conversation_step(u,req,tok,repeat('a',64),'91000000-0000-4000-8000-000000000002',0,'input','다른 계정 덮어쓰기','{}');raise exception 'OWNER_BYPASS';
 exception when others then if sqlerrm<>'CONVERSATION_SESSION_INVALID' then raise; end if;end;
 res=public.commit_conversation_step(u,req,tok,repeat('a',64),s,0,'input','회사보다 일 자체를 바꾸고 싶어','{}');m=(res->>'messageId')::uuid;
 if (select count(*) from public.question_nodes where session_id=s)<>1 then raise exception 'UNAPPROVED_NODE';end if;
 res=public.commit_conversation_step(u,req,tok,repeat('a',64),s,1,'output',null,jsonb_build_object('kind','SHIFT','question','어떤 일을 하고 싶을까?','evidence_sentence','일 자체를 바꾸고 싶다고 표현했어요.','judge',j,'metadata',meta,'turnIds',jsonb_build_object('U2',m),'evidence_ids',jsonb_build_array(m),'carryover','[]'::jsonb,'promoted_branch_id',null,'one_turn_shift',false));
 if res->>'mode'<>'SHIFT' or (select count(*) from public.question_nodes where session_id=s)<>1 then raise exception 'PROPOSAL_WROTE_NODE';end if;
 if (public.claim_ai_request(u,req,repeat('a',64))->>'status')<>'SUCCEEDED' then raise exception 'REPLAY_FAILED';end if;
 if not exists(select 1 from public.conversation_receipts where user_id=u and request_id=req and result=res) then raise exception 'RECEIPT_MISSING';end if;
 req=gen_random_uuid();tok=(public.claim_ai_request(u,req,repeat('b',64))->>'token')::uuid;
 res=public.commit_conversation_step(u,req,tok,repeat('b',64),s,2,'approve','어떤 일을 하고 싶을까?','{}');
 if (select node_count from public.segments where session_id=s)<>2 or (select count(*) from public.shift_edges where session_id=s)<>1 then raise exception 'APPROVAL_NOT_ATOMIC';end if;
 req=gen_random_uuid();tok=(public.claim_ai_request(u,req,repeat('c',64))->>'token')::uuid;
 begin perform public.commit_conversation_step(u,req,tok,repeat('c',64),s,2,'approve','두 번 승인','{}');raise exception 'STALE_APPROVED';exception when others then if sqlerrm<>'CONVERSATION_VERSION_CONFLICT' then raise;end if;end;
 perform public.finish_ai_request(u,req,tok,false,null);
 update public.segments set turn_count=19 where session_id=s;
 req=gen_random_uuid();tok=(public.claim_ai_request(u,req,repeat('d',64))->>'token')::uuid;
 perform public.commit_conversation_step(u,req,tok,repeat('d',64),s,3,'input','조금 더 살펴볼게','{}');
 perform public.commit_conversation_step(u,req,tok,repeat('d',64),s,4,'output',null,'{"kind":"STRUCTURAL","judge":null}');
 req=gen_random_uuid();tok=(public.claim_ai_request(u,req,repeat('e',64))->>'token')::uuid;
 perform public.commit_conversation_step(u,req,tok,repeat('e',64),s,5,'continue',null,'{}');
 if not exists(select 1 from public.segments where session_id=s and ordinal=2 and node_count=0 and turn_count=0 and anchor_node_id is not null) then raise exception 'ANCHOR_COUNTED';end if;
 -- Reaching another limit without a Shift must carry the same anchor, without copying a Node.
 update public.ai_request_limits set minute_count=0 where user_id=u;
 update public.segments set turn_count=20 where session_id=s and ordinal=2;
 update public.conversation_runtime set mode='STRUCTURAL' where session_id=s;
 req=gen_random_uuid();tok=(public.claim_ai_request(u,req,repeat('f',64))->>'token')::uuid;
 perform public.commit_conversation_step(u,req,tok,repeat('f',64),s,6,'continue',null,'{}');
 if (select count(*) from public.question_nodes where session_id=s)<>2 then raise exception 'ANCHOR_DUPLICATED';end if;
 set constraints all immediate;
 -- Bad evidence must roll back all output writes, but retain the safe user input.
 req=gen_random_uuid();tok=(public.claim_ai_request(u,req,repeat('1',64))->>'token')::uuid;
 perform public.commit_conversation_step(u,req,tok,repeat('1',64),s,7,'input','새로운 안전한 발화','{}');
 select count(*) into saved from public.judge_logs where session_id=s;
 begin
  perform public.commit_conversation_step(u,req,tok,repeat('1',64),s,8,'output',null,jsonb_build_object('kind','REFLECT','type','PRESENT','question','어떤 부분일까요?','metadata',meta,'carryover','[]'::jsonb,'turnIds',jsonb_build_object('U2','93000000-0000-4000-8000-000000000002'),'judge','{"action":"REFLECT","shift_confidence":"LOW","medium_reason":null,"evidence_turns":[],"clarifications":[{"text":"남의 근거","confidence":"HIGH","evidence_turns":["U2"]}],"branches":[],"invalidate_clarifications":[],"promote_pile_item":null}'::jsonb));
  raise exception 'FOREIGN_EVIDENCE_ACCEPTED';
 exception when others then if sqlerrm<>'CONVERSATION_EVIDENCE_INVALID' then raise;end if;end;
 if (select count(*) from public.judge_logs where session_id=s)<>saved or exists(select 1 from public.clarifications where session_id=s and text='남의 근거') then raise exception 'PARTIAL_OUTPUT_WRITE';end if;
 -- Finish this same safe turn using CLOSE without confidence.
 perform public.commit_conversation_step(u,req,tok,repeat('1',64),s,8,'output',null,jsonb_build_object('kind','CLOSE','metadata',meta,'carryover','[]'::jsonb,'turnIds','{}'::jsonb,'judge','{"action":"CLOSE","medium_reason":null,"evidence_turns":[],"clarifications":[],"branches":[],"invalidate_clarifications":[],"promote_pile_item":null}'::jsonb));
 if not exists(select 1 from public.judge_logs where session_id=s and action='CLOSE' and shift_confidence is null) then raise exception 'CLOSE_CONFIDENCE_INVENTED';end if;
 req=gen_random_uuid();tok=(public.claim_ai_request(u,req,repeat('2',64))->>'token')::uuid;
 perform public.commit_conversation_step(u,req,tok,repeat('2',64),s,9,'finish',null,'{}');
 if (select status from public.thought_sessions where id=s)<>'COMPLETED' then raise exception 'NOT_COMPLETED';end if;
 -- STOP raw payload is rejected; only minimal Safety metadata is stored.
 req=gen_random_uuid();tok=(public.claim_ai_request(b,req,repeat('3',64))->>'token')::uuid;
 begin perform public.commit_conversation_step(b,req,tok,repeat('3',64),'91000000-0000-4000-8000-000000000002',0,'safety','MUST_NOT_STORE','{"behavior":"STOP","label":"HIGH_RISK","category":"SUICIDE_SELF_HARM"}');raise exception 'STOP_RAW_ACCEPTED';exception when others then if sqlerrm<>'CONVERSATION_SAFETY_INVALID' then raise;end if;end;
 perform public.commit_conversation_step(b,req,tok,repeat('3',64),'91000000-0000-4000-8000-000000000002',0,'safety',null,'{"behavior":"STOP","label":"HIGH_RISK","category":"SUICIDE_SELF_HARM"}');
 if exists(select 1 from public.messages where content='MUST_NOT_STORE') then raise exception 'STOP_RAW_STORED';end if;
 req=gen_random_uuid();tok=(public.claim_ai_request(b,req,repeat('4',64))->>'token')::uuid;
 perform public.commit_conversation_step(b,req,tok,repeat('4',64),'91000000-0000-4000-8000-000000000003',0,'safety','전문 도움을 찾는 테스트 발화','{"behavior":"HANDOFF","label":"NONE","category":"GENERAL_MENTAL_HEALTH"}');
 if not exists(select 1 from public.messages where session_id='91000000-0000-4000-8000-000000000003' and content='전문 도움을 찾는 테스트 발화') then raise exception 'HANDOFF_MESSAGE_MISSING';end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"90000000-0000-4000-8000-000000000002","is_anonymous":false}',true);
do $$begin
 if exists(select 1 from public.conversation_runtime where session_id='91000000-0000-4000-8000-000000000001') then raise exception 'OTHER_OWNER_STATE_VISIBLE';end if;
end $$;
reset role;
rollback;
