-- Withdrawal moves to a one-month grace period at the owner's decision, so the
-- account is marked rather than removed and a purge runs after the deadline.
-- 개인정보 보호법 제21조 still requires destruction without delay once the purpose
-- ends; the delay here exists so a member can undo a mistake, which is why the
-- window is fixed, disclosed, and cancellable by the member alone.
create table public.account_deletions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  requested_at timestamptz not null default now(),
  purge_after timestamptz not null,
  constraint account_deletions_window_check
    check (purge_after > requested_at)
);
alter table public.account_deletions enable row level security;
create policy account_deletions_select_own on public.account_deletions
  for select to authenticated using (user_id = auth.uid());
revoke all on table public.account_deletions from public, anon, authenticated;
grant select on table public.account_deletions to authenticated;

-- Requesting withdrawal. Marks the account; nothing is deleted yet.
create function public.request_account_deletion()
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_purge timestamptz;
begin
  if v_user is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  insert into public.account_deletions (user_id, requested_at, purge_after)
  values (v_user, now(), now() + interval '30 days')
  on conflict (user_id) do nothing;
  select purge_after into v_purge from public.account_deletions where user_id = v_user;
  return v_purge;
end;
$$;
revoke all on function public.request_account_deletion() from public, anon;
grant execute on function public.request_account_deletion() to authenticated;

-- Undoing it, which only the member themselves can do while the window is open.
create function public.cancel_account_deletion()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  delete from public.account_deletions
  where user_id = v_user and purge_after > now();
  if not found then raise exception 'NO_PENDING_DELETION'; end if;
end;
$$;
revoke all on function public.cancel_account_deletion() from public, anon;
grant execute on function public.cancel_account_deletion() to authenticated;

-- The purge itself. Server-only: it deletes accounts, so no client role may run
-- it, and it only ever touches rows whose window has already closed.
create function public.purge_expired_accounts()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_removed integer;
begin
  with due as (
    select user_id from public.account_deletions where purge_after <= now()
  ), gone as (
    delete from auth.users u using due where u.id = due.user_id returning u.id
  )
  select count(*) into v_removed from gone;
  return v_removed;
end;
$$;
revoke all on function public.purge_expired_accounts() from public, anon, authenticated;
grant execute on function public.purge_expired_accounts() to service_role;

-- The immediate-deletion entry point is withdrawn: a member who asks to leave
-- now goes through the window above, and nothing else called this.
drop function if exists public.delete_own_account();
