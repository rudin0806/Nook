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

insert into public.conversation_runtime(session_id,mode)
 values ('91000000-0000-4000-8000-000000000001','CLOSE');
update public.conversation_runtime set mode='READY'
 where session_id='91000000-0000-4000-8000-000000000001';
do $$ begin
 if (select dismissed_closure from public.conversation_runtime where session_id='91000000-0000-4000-8000-000000000001') is distinct from '이직할까?' then raise exception 'CLOSURE_CHOICE_LOST'; end if;
end $$;
-- Ordinary updates must not erase the choice.
update public.conversation_runtime set version=version+1;
do $$ begin
 if (select dismissed_closure from public.conversation_runtime where session_id='91000000-0000-4000-8000-000000000001') is distinct from '이직할까?' then raise exception 'CLOSURE_CHOICE_RESET'; end if;
 if has_function_privilege('authenticated','public.remember_closure_choice()','execute') then raise exception 'TRIGGER_EXPOSED'; end if;
end $$;
rollback;
