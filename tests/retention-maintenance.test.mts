import assert from "node:assert/strict";
import test from "node:test";
import { runRetentionMaintenance } from "../src/lib/retention/maintenance.ts";
const secret = "test-only-secret-32-characters-long";
const env = {
  CRON_SECRET: secret,
  VERCEL_ENV: "production",
  NOOK_RETENTION_CRON_ENABLED: "true",
};
const req = (authorization = `Bearer ${secret}`) =>
  new Request("https://nook.example/api/cron/retention", {
    headers: { authorization },
  });
test("unauthorized, disabled and preview requests never touch the database", async () => {
  let calls = 0;
  const purge = async () => {
    calls++;
    return 0;
  };
  for (const authorization of [
    "",
    "Bearer undefined",
    "Bearer incorrect",
    secret,
  ])
    assert.equal(
      (await runRetentionMaintenance(req(authorization), env, purge)).status,
      401,
    );
  for (const config of [
    { ...env, CRON_SECRET: undefined },
    { ...env, CRON_SECRET: "short" },
    { ...env, VERCEL_ENV: "preview" },
    { ...env, VERCEL_ENV: undefined },
    { ...env, NOOK_RETENTION_CRON_ENABLED: undefined },
  ])
    assert.equal(
      (await runRetentionMaintenance(req(), config, purge)).status,
      503,
    );
  assert.equal(
    (
      await runRetentionMaintenance(
        new Request("https://nook.example", { method: "POST" }),
        env,
        purge,
      )
    ).status,
    405,
  );
  assert.equal(calls, 0);
});
test("authorized maintenance reports actual count with no cache", async () => {
  let calls = 0;
  const response = await runRetentionMaintenance(req(), env, async () => {
    calls++;
    return 2;
  });
  assert.equal(calls, 1);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(await response.json(), {
    code: "RETENTION_COMPLETED",
    deleted: 2,
  });
});
test("failed or uncertain writes are never retried or reported as successful", async () => {
  let calls = 0;
  const response = await runRetentionMaintenance(req(), env, async () => {
    calls++;
    throw new Error("secret database detail");
  });
  assert.equal(calls, 1);
  assert.equal(response.status, 503);
  assert.equal(
    (await response.text()).includes("secret database detail"),
    false,
  );
  for (const result of [
    null,
    undefined,
    "2",
    -1,
    NaN,
    1.5,
    Number.MAX_SAFE_INTEGER + 1,
  ])
    assert.equal(
      (await runRetentionMaintenance(req(), env, async () => result)).status,
      503,
    );
});
