// 상대 경로다. `@/`는 node 테스트 러너가 풀지 못해서, 검사기를 그대로 거는
// tests/example-story.test.mts에서 이 모듈을 읽을 수 없게 된다.
import {
  savedStorySchema,
  type SavedStory,
} from "../../schemas/saved-story.ts";

/** The example screen is the only place in the product that shows records the
 * person did not write, so it reads its data from here and never from the
 * database. Nothing in this module touches Supabase or the model.
 *
 * 노드가 생기면서 생각이 좁혀지는 한 세트다. `노트북을 살까?`로 들어와 `무엇을
 * 하려는가`를 거쳐 `지금 사는 것이 그걸 시작하게 만드는가`에 닿는다. 세 번째
 * 질문에 이르면 살지 말지는 더 이상 취향 문제가 아니라 이번 주말에 해 볼 수 있는
 * 일 하나로 줄어든다 — 그게 이 제품이 말하는 "좁혀진다"이다.
 *
 * 대화문은 제품의 규칙을 그대로 지킨다. 질문은 35자 안쪽이고 분석 말투가 없으며
 * (Prompt D 1.5), 세부로 연달아 세 번 내려가지 않고(4.6), 분명해진 것은 기준·배제·
 * 확정된 사실만 담는다(RULES 6.2). `tests/example-story.test.mts`가 제품의 검사기를
 * 그대로 걸어 이 조건을 지킨다 — 예시가 규칙을 어기면 빌드가 아니라 테스트가 막는다.
 */
export const transcriptPending = false;

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

let sequence = 0;
function message(
  role: "USER" | "ASSISTANT",
  kind: string,
  content: string,
  minute: number,
) {
  sequence += 1;
  return {
    id: `55555555-5555-4555-8555-5555555555${String(sequence).padStart(2, "0")}`,
    role,
    kind,
    content,
    sequence_no: sequence,
    segment_id: SEGMENT_ID,
    created_at: `2026-09-10T11:${String(minute).padStart(2, "0")}:00+09:00`,
  };
}
const U = (content: string, minute: number) =>
  message("USER", "USER_REPLY", content, minute);
const A = (content: string, minute: number) =>
  message("ASSISTANT", "REFLECTION", content, minute);

/** Parsed at module load, so a fixture that stops matching the contract fails
 * the build instead of the page. */
export const exampleStory: SavedStory = savedStorySchema.parse({
  session: {
    id: SESSION_ID,
    origin_branch_id: null,
    started_at: STARTED_AT,
    // 마지막 발화(11:54)보다 뒤여야 한다. 먼저 끝난 이야기에 말이 더 붙어 있으면
    // 결과 칸의 "마친 날"이 대화와 어긋난다.
    completed_at: "2026-09-10T11:56:00+09:00",
    retention_decided_at: "2026-09-10T11:56:00+09:00",
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
    clarification(2, 2, "노트북으로 하려는 것은 영상 편집을 배우는 일"),
    clarification(3, 2, "지금 컴퓨터로도 영상 편집은 할 수 있음"),
    clarification(
      4,
      3,
      "태블릿을 살 때와 달리 이번에는 배우려는 것이 정해져 있음",
    ),
    clarification(5, 3, "이번 주말에 지금 컴퓨터로 첫 편집을 해 볼 수 있음"),
  ],
  messages: [
    message(
      "USER",
      "RAW_THOUGHT",
      "노트북 살까 말까 계속 고민 중이야. 사놓고 잘 못 쓸 것 같아서 결정을 못 하겠어.",
      20,
    ),
    // 노드 1 — 노트북을 살까?
    A("노트북을 살지 생각할 때 지금 가장 걸리는 게 뭐예요?", 24),
    U("돈이 아까운 건 아니야. 사놓고 안 쓸까 봐 그래", 26),
    A("사놓고 안 쓰게 되는 건 어떤 때예요?", 28),
    U("지금 쓰는 게 느리긴 한데, 느려서 안 한 건 아니야", 30),
    A("전에도 사놓고 안 쓴 게 있어요?", 32),
    U("작년에 산 태블릿. 두 달 쓰고 서랍에 넣었어", 34),
    // 여기서 초점이 옮겨간다 — 사는 문제가 아니라 무엇을 하려는가의 문제였다.
    message(
      "ASSISTANT",
      "SHIFT_PROPOSAL",
      "노트북으로 무엇을 하려는지부터 보는 건 어때요?",
      36,
    ),
    // 노드 2 — 나는 노트북으로 무엇을 하려고 하는가?
    A("노트북이 생기면 제일 먼저 뭘 하고 싶어요?", 40),
    U("영상 편집 배우려고", 41),
    A("영상 편집은 지금 컴퓨터로는 못 해요?", 43),
    U("할 수는 있어. 느릴 뿐이야", 44),
    A("느린 걸 참고 한 번이라도 해 본 적 있어요?", 46),
    U("아니, 아직 안 해봤어", 47),
    message(
      "ASSISTANT",
      "SHIFT_PROPOSAL",
      "지금 사는 것이 그걸 시작하게 만드는지 볼까요?",
      48,
    ),
    // 노드 3 — 지금 사는 것이 그걸 실제로 시작하게 만들까?
    A("태블릿 때와 이번이 뭐가 달라요?", 50),
    U("그때는 그냥 사고 싶었고, 이번엔 배우고 싶은 게 있어", 51),
    A("지금 컴퓨터로 첫 편집을 해 본다면 언제 할 수 있어요?", 52),
    U("이번 주말에는 할 수 있어", 53),
    message(
      "ASSISTANT",
      "CLOSURE",
      "노트북을 살지는 이번 주말에 해 보고 나서 다시 보면 되겠어요.",
      54,
    ),
  ],
  offset: 0,
  hasMore: false,
});
