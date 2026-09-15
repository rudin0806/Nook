-- Preserve the user's choice within the existing session lifecycle and RLS.
alter table public.conversation_runtime add column dismissed_closure text
 check (length(dismissed_closure) <= 5000);
create function public.remember_closure_choice() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if old.mode='CLOSE' and new.mode='READY' then
  select content into new.dismissed_closure from public.messages
   where session_id=new.session_id and role='USER' order by sequence_no desc limit 1;
 end if;
 return new;
end $$;
revoke all on function public.remember_closure_choice() from public,anon,authenticated;
create trigger remember_closure_choice before update on public.conversation_runtime
 for each row execute function public.remember_closure_choice();
