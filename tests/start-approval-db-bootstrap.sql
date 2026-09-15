-- Minimal Auth stand-in for an EMPTY isolated PostgreSQL test service, not production.
create schema auth;
create schema extensions;
create role anon;
create role authenticated;
create role service_role bypassrls;
create table auth.users(id uuid primary key, is_anonymous boolean not null default false);
create function auth.uid() returns uuid language sql stable as $$
  select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid
$$;
create function auth.jwt() returns jsonb language sql stable as $$
  select nullif(current_setting('request.jwt.claims',true),'')::jsonb
$$;
grant usage on schema auth,public to anon,authenticated,service_role;
