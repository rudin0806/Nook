import { savedStorySchema, type SavedStory } from "@/schemas/saved-story";

/** The example screen is the only place in the product that shows records the
 * person did not write, so it reads its data from here and never from the
 * database. Nothing in this module touches Supabase or the model.
 *
 * The text below is a STRUCTURAL PLACEHOLDER. It exists so the screen can be
 * built and measured before the real conversation exists, and it is deliberately
 * thin — a reader should not mistake it for the demo. Replace `nodes` and
 * `clarifications` with a transcript from an actual run, keeping the shape, and
 * flip `transcriptPending` to false. Until then the example is not linked from
 * the home screen.
 */
export const transcriptPending = true;

/** Fixed ids and timestamps. A page that regenerated them on each render would
 * produce a different DOM on the server and the client. */
const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const SEGMENT_ID = "22222222-2222-4222-8222-222222222222";
const STARTED_AT = "2026-09-10T11:20:00+09:00";

function node(n: number, text: string, minute: number) {
  return {
    id: `33333333-3333-4333-8333-3333333333${String(n).padStart(2, "0")}`,
    segment_id: SEGMENT_ID,
    ordinal: n,
    final_text: text,
    approved_at: `2026-09-10T11:${String(minute).padStart(2, "0")}:00+09:00`,
  };
}

function clarification(n: number, nodeNumber: number, text: string) {
  return {
    id: `44444444-4444-4444-8444-4444444444${String(n).padStart(2, "0")}`,
    node_id: `33333333-3333-4333-8333-3333333333${String(nodeNumber).padStart(2, "0")}`,
    text,
  };
}

/** Parsed at module load, so a fixture that stops matching the contract fails
 * the build instead of the page. */
export const exampleStory: SavedStory = savedStorySchema.parse({
  session: {
    id: SESSION_ID,
    origin_branch_id: null,
    started_at: STARTED_AT,
    completed_at: "2026-09-10T11:52:00+09:00",
    retention_decided_at: "2026-09-10T11:52:00+09:00",
    shelf_position: 1,
    shelf_revision: "0".repeat(32),
    turn_count: 9,
    node_count: 3,
  },
  initialThought:
    "노트북 살까 말까 계속 고민 중이야. 사놓고 잘 못 쓸 것 같아서 결정을 못 하겠어.",
  segments: [
    {
      id: SEGMENT_ID,
      ordinal: 1,
      nodes: [
        node(1, "노트북을 살까?", 24),
        node(2, "나는 노트북으로 무엇을 하려고 하는가?", 38),
        node(3, "지금 사는 것이 그걸 실제로 시작하게 만들까?", 50),
      ],
    },
  ],
  clarifications: [
    clarification(1, 1, "돈이 부담인 것은 아님"),
    clarification(2, 2, "지금 하고 싶은 작업이 뚜렷하지는 않음"),
  ],
  offset: 0,
  hasMore: false,
});
