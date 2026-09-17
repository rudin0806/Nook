-- 개인정보 보호법 제22조 requires consent to be taken per item and to be
-- demonstrable afterwards, so the record pins which version of each document was
-- agreed to and when. No further personal data is stored here: the row is keyed
-- by the account and disappears with it on withdrawal.
create table public.consents (
  user_id uuid primary key references auth.users (id) on delete cascade,
  terms_version text not null,
  privacy_version text not null,
  agreed_at timestamptz not null default now(),
  constraint consents_terms_version_check check (btrim(terms_version) <> ''),
  constraint consents_privacy_version_check check (btrim(privacy_version) <> '')
);
alter table public.consents enable row level security;

-- Readable by its owner so the member can see what they agreed to; never written
-- directly, so a client cannot backdate or forge a consent record. The row-level
-- policy narrows the rows; the table grant is what allows the read at all.
create policy consents_select_own on public.consents
  for select to authenticated using (user_id = auth.uid());
revoke all on table public.consents from public, anon;
grant select on table public.consents to authenticated;

create function public.record_consent(p_terms_version text, p_privacy_version text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  -- Consent belongs to an identified member, not to a temporary visitor.
  if coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then
    raise exception 'IDENTITY_LINK_REQUIRED';
  end if;
  if coalesce(btrim(p_terms_version), '') = ''
    or coalesce(btrim(p_privacy_version), '') = '' then
    raise exception 'CONSENT_VERSION_REQUIRED';
  end if;
  insert into public.consents (user_id, terms_version, privacy_version)
  values (v_user, btrim(p_terms_version), btrim(p_privacy_version))
  on conflict (user_id) do update
    set terms_version = excluded.terms_version,
        privacy_version = excluded.privacy_version,
        agreed_at = now();
end;
$$;
revoke all on function public.record_consent(text, text) from public, anon;
grant execute on function public.record_consent(text, text) to authenticated;
