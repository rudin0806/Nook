-- Read-only. Never executes application RPCs or changes migration history.
-- Run as the project administrator before and after the two pending migrations.
with required_tables(name, client_read) as (
 values ('conversation_runtime',true),('conversation_receipts',false),
        ('start_drafts',false),('session_origins',true)
), table_checks as (
 select 'table:'||r.name as check_name,
  coalesce(c.relrowsecurity,false)
  and coalesce(has_table_privilege('service_role',c.oid,'SELECT'),false)
  and coalesce(has_table_privilege('service_role',c.oid,'INSERT'),false)
  and coalesce(has_table_privilege('service_role',c.oid,'UPDATE'),false)
  and coalesce(has_table_privilege('service_role',c.oid,'DELETE'),false)
  and not coalesce(has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE'),false)
  and not coalesce(has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE'),false)
  and coalesce(has_table_privilege('authenticated',c.oid,'SELECT'),false)=r.client_read
  and c.oid is not null as passed
 from required_tables r left join pg_namespace ns on ns.nspname='public'
 left join pg_class c on c.relnamespace=ns.oid and c.relname=r.name and c.relkind='r'
), required_functions(signature, client_execute) as (
 values
 ('public.commit_conversation_step(uuid,uuid,uuid,text,uuid,integer,text,text,jsonb)',false),
 ('public.commit_start_with_recovery(uuid,uuid,uuid,text,uuid,uuid,text,text,public.safety_label,public.safety_category,uuid,timestamptz,jsonb,text,uuid)',false),
 ('public.settle_retention_for_user(uuid)',false),
 ('public.restart_source_for_user(uuid,text,uuid)',false),
 ('public.settle_own_retention()',true),
 ('public.read_restart_source(text,uuid)',true),
 ('public.list_recoverable_sessions(integer,integer)',true)
), function_checks as (
 select 'rpc:'||signature as check_name,
 to_regprocedure(signature) is not null
 and not coalesce(has_function_privilege('anon',to_regprocedure(signature),'EXECUTE'),false)
 and coalesce(has_function_privilege('authenticated',to_regprocedure(signature),'EXECUTE'),false)=client_execute
 and (client_execute or coalesce(has_function_privilege('service_role',to_regprocedure(signature),'EXECUTE'),false)) as passed
 from required_functions
)
select check_name,passed from table_checks union all select check_name,passed from function_checks order by check_name;
