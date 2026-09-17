import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import { readSavedStory } from "../src/lib/retention/story-query.ts";
const sid = "11111111-1111-4111-8111-111111111111";
const gid = "22222222-2222-4222-8222-222222222222";
const nid = "33333333-3333-4333-8333-333333333333";
const now = "2026-09-14T00:00:00Z";
const session = {
  id: sid,
  origin_branch_id: null,
  started_at: now,
  completed_at: now,
  retention_decided_at: now,
  shelf_position: null,
  shelf_revision: "0".repeat(32),
  turn_count: 6,
  node_count: 2,
};
function fixture(
  options: {
    missing?: boolean;
    removed?: boolean;
    failure?: boolean;
    long?: boolean;
    rawOnly?: boolean;
  } = {},
) {
  const urls: URL[] = [];
  let reads = 0;
  const client = createClient(
    "https://fixture.supabase.co",
    "fixture-public-key",
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: async (input) => {
          const url = new URL(String(input));
          urls.push(url);
          let value: unknown = [];
          if (url.pathname.endsWith("saved_thought_sessions")) {
            reads++;
            value =
              options.missing || (options.removed && reads === 2)
                ? null
                : session;
          }
          if (url.pathname.endsWith("segments")) {
            if (options.failure)
              return Response.json(
                { message: "private-database-content" },
                { status: 400 },
              );
            value = options.long
              ? Array.from({ length: 11 }, (_, i) => ({
                  id: `22222222-2222-4222-8222-${String(i + 1).padStart(12, "0")}`,
                  ordinal: i + 1,
                }))
              : [{ id: gid, ordinal: 1 }];
          }
          if (url.pathname.endsWith("question_nodes"))
            value = options.rawOnly
              ? []
              : [
                  {
                    id: nid,
                    segment_id: gid,
                    ordinal: 1,
                    final_text: "계속 만날까?",
                    approved_at: now,
                    ai_proposed_text: "private proposal",
                  },
                ];
          if (url.pathname.endsWith("messages"))
            value = { content: "아직 질문으로 정리하지 못한 생각" };
          if (url.pathname.endsWith("clarifications"))
            value = [
              {
                id: "44444444-4444-4444-8444-444444444444",
                node_id: nid,
                text: "내가 말한 내용",
                private_field: "omit",
              },
            ];
          return Response.json(value);
        },
      },
    },
  );
  return { client, urls };
}
test("invisible or unsaved parent returns no detail and never queries children", async () => {
  const { client, urls } = fixture({ missing: true });
  assert.equal(await readSavedStory(client, sid, {}), null);
  assert.equal(urls.length, 1);
});
test("queries are session-scoped, bounded, ordered, and expose approved text only", async () => {
  const { client, urls } = fixture();
  const story = await readSavedStory(client, sid, {});
  assert.ok(story);
  assert.equal(story.segments[0].nodes[0].final_text, "계속 만날까?");
  assert.equal("ai_proposed_text" in story.segments[0].nodes[0], false);
  assert.equal("private_field" in story.clarifications[0], false);
  for (const url of urls.slice(1, -1))
    assert.equal(url.searchParams.get("session_id"), `eq.${sid}`);
  const segments = urls.find((u) => u.pathname.endsWith("segments"))!;
  assert.equal(segments.searchParams.get("order"), "ordinal.asc");
  assert.equal(segments.searchParams.get("limit"), "11");
  const clarification = urls.find((u) =>
    u.pathname.endsWith("clarifications"),
  )!;
  assert.equal(clarification.searchParams.get("status"), "eq.ACTIVE");
  assert.equal(clarification.searchParams.get("limit"), "201");
});
test("concurrent removal from saved collection prevents detail response", async () => {
  const { client } = fixture({ removed: true });
  assert.equal(await readSavedStory(client, sid, {}), null);
});
test("invalid input makes no request and database failure does not expose details", async () => {
  const { client, urls } = fixture({ failure: true });
  await assert.rejects(() => readSavedStory(client, "../other", {}));
  assert.equal(urls.length, 0);
  await assert.rejects(() => readSavedStory(client, sid, { offset: -1 }));
  assert.equal(urls.length, 0);
  await assert.rejects(
    () => readSavedStory(client, sid, {}),
    /^Error: STORY_QUERY_FAILED$/,
  );
});

test("segment pagination reports a next page without returning the lookahead row", async () => {
  const { client, urls } = fixture({ long: true });
  const story = await readSavedStory(client, sid, { offset: 10 });
  assert.ok(story);
  assert.equal(story.segments.length, 10);
  assert.equal(story.hasMore, true);
  assert.equal(story.offset, 10);
  const url = urls.find((u) => u.pathname.endsWith("segments"))!;
  assert.equal(url.searchParams.get("offset"), "10");
});

test("saving before first approval exposes original input separately without inventing a Node", async () => {
  const { client, urls } = fixture({ rawOnly: true });
  const story = await readSavedStory(client, sid, {});
  assert.ok(story);
  assert.equal(story.initialThought, "아직 질문으로 정리하지 못한 생각");
  assert.equal(story.segments[0].nodes.length, 0);
  const raw = urls.find((u) => u.pathname.endsWith("messages"))!;
  assert.equal(raw.searchParams.get("session_id"), `eq.${sid}`);
  assert.equal(raw.searchParams.get("kind"), "eq.RAW_THOUGHT");
  assert.equal(raw.searchParams.get("role"), "eq.USER");
});
