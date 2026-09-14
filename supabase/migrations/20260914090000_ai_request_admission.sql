-- Server-owned admission ledger. Contains no user text or model output.
create table public.ai_request_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  minute_start timestamptz not null default '-infinity',
  minute_count integer not null default 0,
  day_start timestamptz not null default '-infinity',
  day_count integer not null default 0
);
create table public.ai_requests (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  fingerprint text not null check (fingerprint ~ '^[0-9a-f]{64}$'),
  state text not null check (state in ('RUNNING','SUCCEEDED','FAILED')),
  token uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  deadline timestamptz not null,
  result_id uuid,
  primary key (user_id,request_id),
  check (state = 'SUCCEEDED' or result_id is null)
);
create index ai_requests_running on public.ai_requests(user_id,deadline) where state = 'RUNNING';
alter table public.ai_request_limits enable row level security;
alter table public.ai_requests enable row level security;
revoke all on public.ai_request_limits, public.ai_requests from public, anon, authenticated;
-- No direct service writes: mutations go through the functions.
revoke all on public.ai_request_limits, public.ai_requests from service_role;

create function public.claim_ai_request(p_user uuid, p_request uuid, p_fingerprint text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  t timestamptz;
  q public.ai_request_limits%rowtype;
  r public.ai_requests%rowtype;
  lease uuid;
begin
  if p_user is null or p_request is null or p_fingerprint is null or p_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception 'INVALID_REQUEST' using errcode = '22023';
  end if;
  insert into public.ai_request_limits(user_id) values(p_user) on conflict do nothing;
  select * into q from public.ai_request_limits where user_id=p_user for update;
  t := clock_timestamp();
  update public.ai_requests set state='FAILED'
    where user_id=p_user and state='RUNNING' and deadline<=t;
  select * into r from public.ai_requests where user_id=p_user and request_id=p_request;
  if found then
    if r.fingerprint <> p_fingerprint then
      return jsonb_build_object('status','CONFLICT');
    end if;
    return jsonb_build_object('status',r.state,'result_id',r.result_id);
  end if;
  if exists(select 1 from public.ai_requests where user_id=p_user and state='RUNNING') then
    return jsonb_build_object('status','BUSY','retry_after',5);
  end if;
  if q.minute_start<=t-interval '1 minute' then q.minute_start:=t; q.minute_count:=0; end if;
  if q.day_start<>(date_trunc('day',t at time zone 'UTC') at time zone 'UTC') then
    q.day_start:=date_trunc('day',t at time zone 'UTC') at time zone 'UTC'; q.day_count:=0;
  end if;
  if q.minute_count>=5 then
    return jsonb_build_object('status','RATE_LIMITED','retry_after',greatest(1,ceil(extract(epoch from q.minute_start+interval '1 minute'-t))));
  end if;
  if q.day_count>=50 then
    return jsonb_build_object('status','RATE_LIMITED','retry_after',greatest(1,ceil(extract(epoch from q.day_start+interval '1 day'-t))));
  end if;
  lease:=gen_random_uuid();
  insert into public.ai_requests(user_id,request_id,fingerprint,state,token,deadline)
    values(p_user,p_request,p_fingerprint,'RUNNING',lease,t+interval '5 minutes');
  update public.ai_request_limits set minute_start=q.minute_start,minute_count=q.minute_count+1,
    day_start=q.day_start,day_count=q.day_count+1 where user_id=p_user;
  return jsonb_build_object('status','CLAIMED','token',lease);
end $$;

create function public.finish_ai_request(p_user uuid,p_request uuid,p_token uuid,p_success boolean,p_result uuid default null)
returns boolean language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if p_success is null then raise exception 'INVALID_REQUEST' using errcode='22023'; end if;
  perform 1 from public.ai_request_limits where user_id=p_user for update;
  update public.ai_requests set state=case when p_success then 'SUCCEEDED' else 'FAILED' end,
    result_id=case when p_success then p_result else null end
    where user_id=p_user and request_id=p_request and token=p_token and state='RUNNING' and deadline>clock_timestamp();
  get diagnostics n=row_count;
  return n=1;
end $$;
revoke all on function public.claim_ai_request(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.finish_ai_request(uuid,uuid,uuid,boolean,uuid) from public,anon,authenticated;
grant execute on function public.claim_ai_request(uuid,uuid,text) to service_role;
grant execute on function public.finish_ai_request(uuid,uuid,uuid,boolean,uuid) to service_role;
