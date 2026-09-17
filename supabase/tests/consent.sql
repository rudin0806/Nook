-- Synthetic data only. Run via tools/db-replay/replay.mjs.
begin;
do $$
declare
  member_id uuid := gen_random_uuid();
  other_id uuid := gen_random_uuid();
  visitor_id uuid := gen_random_uuid();
  stored_terms text;
  first_agreed timestamptz;
  second_agreed timestamptz;
  visible integer;
begin
  insert into auth.users(id) values(member_id),(other_id);
  insert into auth.users(id,is_anonymous) values(visitor_id,true);

  -- A signed-out caller cannot record consent.
  perform set_config('request.jwt.claims','',true);
  set local role anon;
  begin
    perform public.record_consent('2026-09-19','2026-09-19');
    reset role;
    raise exception 'FAIL anon permitted';
  exception when insufficient_privilege then reset role;
  end;

  -- A temporary visitor has no account to attach consent to.
  perform set_config('request.jwt.claims',json_build_object('sub',visitor_id,'is_anonymous',true)::text,true);
  set local role authenticated;
  begin
    perform public.record_consent('2026-09-19','2026-09-19');
    reset role;
    raise exception 'FAIL anonymous visitor permitted';
  exception when raise_exception then
    reset role;
    if sqlerrm <> 'IDENTITY_LINK_REQUIRED' then raise; end if;
  end;

  -- An empty version is not a record of anything.
  perform set_config('request.jwt.claims',json_build_object('sub',member_id,'is_anonymous',false)::text,true);
  set local role authenticated;
  begin
    perform public.record_consent('  ','2026-09-19');
    reset role;
    raise exception 'FAIL blank version permitted';
  exception when raise_exception then
    reset role;
    if sqlerrm <> 'CONSENT_VERSION_REQUIRED' then raise; end if;
  end;

  -- The member records consent and can read back what they agreed to.
  perform set_config('request.jwt.claims',json_build_object('sub',member_id,'is_anonymous',false)::text,true);
  set local role authenticated;
  perform public.record_consent('2026-09-19','2026-09-19');
  select terms_version, agreed_at into stored_terms, first_agreed
  from public.consents where user_id=member_id;
  if stored_terms <> '2026-09-19' then raise exception 'FAIL version not stored'; end if;

  -- A later version replaces the record rather than duplicating the key.
  -- agreed_at uses now(), which is the transaction time, so only the version is
  -- asserted here; the timestamp is exercised by separate calls in production.
  perform public.record_consent('2027-01-01','2027-01-01');
  select terms_version, agreed_at into stored_terms, second_agreed
  from public.consents where user_id=member_id;
  if stored_terms <> '2027-01-01' then raise exception 'FAIL re-consent did not update the version'; end if;
  if second_agreed < first_agreed then raise exception 'FAIL consent time went backwards'; end if;
  if (select count(*) from public.consents where user_id=member_id) <> 1 then
    raise exception 'FAIL duplicate consent rows';
  end if;

  -- A client cannot write the table directly, so consent cannot be forged.
  begin
    insert into public.consents(user_id,terms_version,privacy_version)
    values(other_id,'forged','forged');
    reset role;
    raise exception 'FAIL direct insert permitted';
  exception when insufficient_privilege then reset role;
  end;

  -- Another member's consent is not visible.
  perform set_config('request.jwt.claims',json_build_object('sub',member_id,'is_anonymous',false)::text,true);
  set local role authenticated;
  perform public.record_consent('2026-09-19','2026-09-19');
  reset role;
  perform set_config('request.jwt.claims',json_build_object('sub',other_id,'is_anonymous',false)::text,true);
  set local role authenticated;
  select count(*) into visible from public.consents;
  reset role;
  if visible <> 0 then raise exception 'FAIL another member consent visible'; end if;

  -- Consent records are read-only to clients: no privilege may allow a signed-in
  -- caller to write or wipe the table, only the definer function may.
  if exists(
    select 1 from information_schema.role_table_grants
    where table_schema='public' and table_name='consents'
      and grantee='authenticated' and privilege_type <> 'SELECT'
  ) then
    raise exception 'FAIL authenticated holds more than SELECT on consents';
  end if;

  -- Withdrawal takes the consent record with it.
  perform set_config('request.jwt.claims',json_build_object('sub',member_id,'is_anonymous',false)::text,true);
  set local role authenticated;
  perform public.delete_own_account();
  reset role;
  if exists(select 1 from public.consents where user_id=member_id) then
    raise exception 'FAIL consent survived withdrawal';
  end if;
end;
$$;
select 'PASS consent recording, versioning, isolation, and removal on withdrawal' as result;
rollback;
