-- The previous migration revoked only from public and anon, so Supabase's
-- default privileges left authenticated holding TRUNCATE, TRIGGER and REFERENCES
-- on the consent records. Every other table in this schema gives authenticated
-- SELECT alone, and a TRUNCATE grant would let a signed-in client erase the
-- proof of consent for every member.
revoke all on table public.consents from public, anon, authenticated;
grant select on table public.consents to authenticated;
