import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
const db = new PGlite();
await db.exec(
  `create schema auth; create schema extensions; create role anon; create role authenticated; create role service_role bypassrls; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub'$$;`
    .replace("::jsonb->>'sub'", "::jsonb->>'sub'")
    .replace(
      "select nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub'",
      "select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid",
    ),
);
await db.exec(
  `create function auth.jwt() returns jsonb language sql stable as $$select nullif(current_setting('request.jwt.claims',true),'')::jsonb$$; grant usage on schema auth,public to anon,authenticated,service_role;`,
);
const dir = new URL("../../supabase/migrations/", import.meta.url);
if (process.argv.includes("--helper"))
  await db.exec(
    "create function public.rls_auto_enable() returns event_trigger language plpgsql as $$begin return; end$$;",
  );
for (const f of readdirSync(dir).sort()) {
  const sql = readFileSync(new URL(f, dir), "utf8").replace(
    "create extension if not exists pgcrypto with schema extensions;",
    "-- PGlite: pgcrypto unavailable; gen_random_uuid is built into Postgres",
  );
  try {
    await db.exec(sql);
    console.log("PASS", f);
  } catch (e) {
    console.log("FAIL", f, e.message);
    await db.exec("rollback");
    process.exitCode = 1;
    break;
  }
}
if (!process.exitCode) {
  await db.exec(
    readFileSync(
      new URL("../../supabase/tests/retention_rls.sql", import.meta.url),
      "utf8",
    ),
  );
  console.log("PASS RLS/retention assertions; rollback complete");
}
if (!process.exitCode && process.argv.includes("--helper")) {
  const r = await db.query(
    "select has_function_privilege('anon','public.rls_auto_enable()','EXECUTE') as anon, has_function_privilege('authenticated','public.rls_auto_enable()','EXECUTE') as authenticated",
  );
  if (r.rows[0].anon || r.rows[0].authenticated)
    throw Error("helper permissions");
  console.log("PASS optional helper privileges");
}
await db.close();
