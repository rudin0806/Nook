-- Withdrawal returns to immediate deletion, and a withdrawn sign-in method may
-- not be used to rejoin for a month.
--
-- Those two pull against each other: refusing the same method requires keeping
-- something that identifies it. What is kept is an HMAC of the provider subject
-- computed with a server-only key, never the email, the subject, or anything
-- readable. It is still personal data, so it is disclosed in the policy, held
-- for the block window only, and swept on the same hourly job.
drop function if exists public.request_account_deletion();
drop function if exists public.cancel_account_deletion();
drop function if exists public.purge_expired_accounts();
drop table if exists public.account_deletions;

create table public.withdrawn_identities (
  identity_hash text primary key,
  withdrawn_at timestamptz not null default now(),
  blocked_until timestamptz not null,
  constraint withdrawn_identities_hash_check check (identity_hash ~ '^[a-f0-9]{64}$'),
  constraint withdrawn_identities_window_check check (blocked_until > withdrawn_at)
);
alter table public.withdrawn_identities enable row level security;
-- No policy and no grant: nothing reads this table directly, not even its owner
-- through the API. The two functions below are the only way in.
revoke all on table public.withdrawn_identities from public, anon, authenticated;

-- Withdrawal. The account row is the single point of deletion: everything that
-- holds the member's data reaches auth.users through a cascading foreign key,
-- auth.identities included. The hash is recorded first so a crash cannot leave
-- the account gone and the block missing.
create function public.delete_own_account(p_identity_hash text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if p_identity_hash is not null then
    if p_identity_hash !~ '^[a-f0-9]{64}$' then
      raise exception 'IDENTITY_HASH_INVALID';
    end if;
    insert into public.withdrawn_identities (identity_hash, withdrawn_at, blocked_until)
    values (p_identity_hash, now(), now() + interval '30 days')
    on conflict (identity_hash) do update
      set withdrawn_at = now(),
          blocked_until = greatest(
            public.withdrawn_identities.blocked_until,
            now() + interval '30 days'
          );
  end if;
  delete from auth.users where id = v_user;
end;
$$;
revoke all on function public.delete_own_account(text) from public, anon;
grant execute on function public.delete_own_account(text) to authenticated;

-- Asked during the sign-in callback. Returns the deadline when the method is
-- still blocked and null otherwise. Knowing a hash requires the server key, so
-- this cannot be used to test whether a given person ever withdrew.
create function public.rejoin_blocked_until(p_identity_hash text)
returns timestamptz language sql stable security definer set search_path = '' as $$
  select blocked_until
  from public.withdrawn_identities
  where identity_hash = p_identity_hash and blocked_until > now();
$$;
revoke all on function public.rejoin_blocked_until(text) from public, anon;
grant execute on function public.rejoin_blocked_until(text) to authenticated;

-- The block is not kept past its window.
create function public.purge_expired_rejoin_blocks()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_removed integer;
begin
  with gone as (
    delete from public.withdrawn_identities where blocked_until <= now() returning 1
  )
  select count(*) into v_removed from gone;
  return v_removed;
end;
$$;
revoke all on function public.purge_expired_rejoin_blocks() from public, anon, authenticated;
grant execute on function public.purge_expired_rejoin_blocks() to service_role;
