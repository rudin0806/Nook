import assert from "node:assert/strict";
import test from "node:test";
import { mapDatabaseProblem } from "../src/lib/api/problem.ts";
import { parseJson, RequestInputError } from "../src/lib/api/request.ts";
import {
  finalizeRetentionSchema,
  retentionListQuerySchema,
  savedSessionListItemSchema,
  sessionIdSchema,
} from "../src/schemas/retention.ts";

const firstId = "11111111-1111-4111-8111-111111111111";
const secondId = "22222222-2222-4222-8222-222222222222";

test("retention input applies defaults and rejects duplicate branch selections", () => {
  assert.deepEqual(finalizeRetentionSchema.parse({ keepSession: true }), {
    keepSession: true,
    keptBranchIds: [],
  });
  assert.equal(
    finalizeRetentionSchema.safeParse({
      keepSession: false,
      keptBranchIds: [firstId, firstId],
    }).success,
    false,
  );
  assert.ok(
    finalizeRetentionSchema.safeParse({
      keepSession: false,
      keptBranchIds: [firstId, secondId],
    }).success,
  );
});

test("identifiers and list bounds reject malformed input", () => {
  assert.ok(sessionIdSchema.safeParse(firstId).success);
  assert.equal(sessionIdSchema.safeParse("../../other-user").success, false);
  assert.deepEqual(retentionListQuerySchema.parse({}), {
    collection: "saved",
    limit: 20,
    offset: 0,
  });
  assert.equal(
    retentionListQuerySchema.safeParse({ collection: "all" }).success,
    false,
  );
  assert.equal(
    retentionListQuerySchema.safeParse({ limit: "51" }).success,
    false,
  );
});

test("session list contract excludes undeclared fields", () => {
  const parsed = savedSessionListItemSchema.parse({
    id: firstId,
    user_id: secondId,
    origin_branch_id: null,
    started_at: "2026-09-13T00:00:00+00:00",
    completed_at: "2026-09-13T00:10:00+00:00",
    retention_decided_at: "2026-09-13T00:11:00+00:00",
    shelf_position: null,
  });
  assert.equal("user_id" in parsed, false);
});

test("database errors map to stable public codes without losing specificity", () => {
  assert.equal(
    mapDatabaseProblem("SAVED_SESSION_NOT_FOUND").code,
    "SAVED_SESSION_NOT_FOUND",
  );
  assert.equal(
    mapDatabaseProblem("RESTORABLE_SESSION_NOT_FOUND").code,
    "RESTORABLE_SESSION_NOT_FOUND",
  );
  assert.equal(
    mapDatabaseProblem("private database detail").code,
    "DATABASE_REQUEST_FAILED",
  );
});

test("JSON body parser enforces content type, syntax, schema, and size", async () => {
  const valid = new Request("https://nook.test/api", {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({ keepSession: true }),
  });
  assert.deepEqual(await parseJson(valid, finalizeRetentionSchema), {
    keepSession: true,
    keptBranchIds: [],
  });

  const failures = [
    new Request("https://nook.test/api", { method: "POST", body: "{}" }),
    new Request("https://nook.test/api", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    }),
    new Request("https://nook.test/api", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ keepSession: "yes" }),
    }),
    new Request("https://nook.test/api", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ keepSession: true, padding: "x".repeat(9_000) }),
    }),
  ];

  for (const request of failures) {
    await assert.rejects(
      () => parseJson(request, finalizeRetentionSchema),
      RequestInputError,
    );
  }
});
