-- Isolated CI database only. No production connection or real user data.
create schema auth;
create table auth.users(id uuid primary key);
create role anon;
create role authenticated;
create role service_role;
\i supabase/migrations/20260914090000_ai_request_admission.sql
insert into auth.users values ('10000000-0000-4000-8000-000000000001'),('10000000-0000-4000-8000-000000000002');
do $$
declare
 u uuid:='10000000-0000-4000-8000-000000000001';
 r uuid:=gen_random_uuid(); j jsonb; k jsonb; i integer;
begin
 if has_table_privilege('authenticated','public.ai_requests','SELECT') or
 has_function_privilege('authenticated','public.claim_ai_request(uuid,uuid,text)','EXECUTE') or
 has_function_privilege('anon','public.finish_ai_request(uuid,uuid,uuid,boolean,uuid)','EXECUTE') then raise exception 'public access'; end if;
 if not has_function_privilege('service_role','public.claim_ai_request(uuid,uuid,text)','EXECUTE') then raise exception 'service access missing'; end if;
 j:=public.claim_ai_request(u,r,repeat('a',64));
 if j->>'status'<>'CLAIMED' then raise exception 'first claim'; end if;
 k:=public.claim_ai_request(u,r,repeat('a',64));
 if k->>'status'<>'RUNNING' then raise exception 'duplicate'; end if;
 if (select minute_count from public.ai_request_limits where user_id=u)<>1 then raise exception 'duplicate charged'; end if;
 if public.claim_ai_request(u,r,repeat('b',64))->>'status'<>'CONFLICT' then raise exception 'fingerprint'; end if;
 if public.claim_ai_request(u,gen_random_uuid(),repeat('a',64))->>'status'<>'BUSY' then raise exception 'parallel user work'; end if;
 if public.finish_ai_request(u,r,gen_random_uuid(),true,r) then raise exception 'wrong token'; end if;
 if public.finish_ai_request('10000000-0000-4000-8000-000000000002',r,(j->>'token')::uuid,true,r) then raise exception 'wrong user'; end if;
 if not public.finish_ai_request(u,r,(j->>'token')::uuid,true,r) then raise exception 'finish'; end if;
 k:=public.claim_ai_request(u,r,repeat('a',64));
 if k->>'status'<>'SUCCEEDED' or (k->>'result_id')::uuid<>r then raise exception 'replay'; end if;
 if public.finish_ai_request(u,r,(j->>'token')::uuid,true,r) then raise exception 'double finish'; end if;
 for i in 2..5 loop
   r:=gen_random_uuid(); j:=public.claim_ai_request(u,r,repeat('a',64));
   if j->>'status'<>'CLAIMED' then raise exception 'early minute limit'; end if;
   perform public.finish_ai_request(u,r,(j->>'token')::uuid,false,null);
 end loop;
 if public.claim_ai_request(u,gen_random_uuid(),repeat('a',64))->>'status'<>'RATE_LIMITED' then raise exception 'sixth allowed'; end if;
 if (select day_count from public.ai_request_limits where user_id=u)<>5 then raise exception 'rejected request charged'; end if;
 for i in 6..50 loop
   update public.ai_request_limits set minute_start=clock_timestamp()-interval '1 minute' where user_id=u;
   r:=gen_random_uuid(); j:=public.claim_ai_request(u,r,repeat('a',64));
   if j->>'status'<>'CLAIMED' then raise exception 'early day limit %',i; end if;
   perform public.finish_ai_request(u,r,(j->>'token')::uuid,false,null);
 end loop;
 update public.ai_request_limits set minute_start=clock_timestamp()-interval '1 minute' where user_id=u;
 if public.claim_ai_request(u,gen_random_uuid(),repeat('a',64))->>'status'<>'RATE_LIMITED' then raise exception '51st allowed'; end if;
 update public.ai_request_limits set day_start=day_start-interval '1 day' where user_id=u;
 r:=gen_random_uuid(); j:=public.claim_ai_request(u,r,repeat('a',64));
 if j->>'status'<>'CLAIMED' then raise exception 'daily reset'; end if;
 update public.ai_requests set deadline=clock_timestamp() where user_id=u and request_id=r;
 if public.finish_ai_request(u,r,(j->>'token')::uuid,true,r) then raise exception 'late completion'; end if;
 if public.claim_ai_request(u,r,repeat('a',64))->>'status'<>'FAILED' then raise exception 'timeout reexecuted'; end if;
 delete from auth.users where id=u;
 if exists(select 1 from public.ai_requests where user_id=u) then raise exception 'account cascade'; end if;
end $$;
-- Second user is reserved for the concurrent multi-connection test.
