begin;

alter table public.thought_sessions
  alter column temporary_expires_at drop not null;

commit;
