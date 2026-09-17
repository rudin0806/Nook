-- Withdrawal. The account row is the single point of deletion: every table that
-- holds the member's data reaches auth.users through a cascading foreign key,
-- including auth.identities, which carries the linked social account. Nothing is
-- copied aside first, so there is no withdrawal record to keep or to expire.
-- The function takes no argument, so a caller can only ever delete themselves.
create function public.delete_own_account() returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  delete from auth.users where id = v_user;
end;
$$;
revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;
