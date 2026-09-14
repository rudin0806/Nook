-- Separate fixture for concurrent RPC commits after rollback-only tests.
insert into auth.users(id) values('10000000-0000-4000-8000-000000000010');
insert into public.thought_sessions(id,user_id)
  values('20000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000010');
insert into public.segments(id,session_id,ordinal)
  values('30000000-0000-4000-8000-000000000010','20000000-0000-4000-8000-000000000010',1);
insert into public.messages(id,session_id,segment_id,role,kind,content,sequence_no,user_turn_no)
  values('40000000-0000-4000-8000-000000000010','20000000-0000-4000-8000-000000000010',
    '30000000-0000-4000-8000-000000000010','USER','RAW_THOUGHT','회사를 옮길까?',1,1);
