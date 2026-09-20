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
 * produce a different DOM on the server and the client.
 *
 * 미리보기 책장에 책이 둘이라 이야기도 둘이다. `seed` 한 자리로 아이디를 갈라 두
 * 이야기가 섞이지 않게 한다 — 한 이야기만 두고 두 책이 같은 것을 열면 책등의
 * 제목과 안의 내용이 어긋난다.
 */
const STARTED_AT = "2026-09-10T11:20:00+09:00";

function storyParts(seed: number) {
  const s = String(seed);
  const sessionId = `11111111-1111-4111-8111-11111111111${s}`;
  const segmentId = `22222222-2222-4222-8222-22222222222${s}`;
  const nodeId = (n: number) =>
    `3333333${s}-3333-4333-8333-3333333333${String(n).padStart(2, "0")}`;
  let sequence = 0;
  const message = (
    role: "USER" | "ASSISTANT",
    kind: string,
    content: string,
    minute: number,
  ) => {
    sequence += 1;
    return {
      id: `5555555${s}-5555-4555-8555-5555555555${String(sequence).padStart(2, "0")}`,
      role,
      kind,
      content,
      sequence_no: sequence,
      segment_id: segmentId,
      created_at: `2026-09-10T11:${String(minute).padStart(2, "0")}:00+09:00`,
    };
  };
  return {
    sessionId,
    segmentId,
    message,
    node: (n: number, text: string, minute: number) => ({
      id: nodeId(n),
      segment_id: segmentId,
      ordinal: n,
      final_text: text,
      approved_at: `2026-09-10T11:${String(minute).padStart(2, "0")}:00+09:00`,
    }),
    clarification: (n: number, nodeNumber: number, text: string) => ({
      id: `4444444${s}-4444-4444-8444-4444444444${String(n).padStart(2, "0")}`,
      node_id: nodeId(nodeNumber),
      text,
    }),
    U: (content: string, minute: number) =>
      message("USER", "USER_REPLY", content, minute),
    A: (content: string, minute: number) =>
      message("ASSISTANT", "REFLECTION", content, minute),
  };
}

const first = storyParts(1);
const {
  sessionId: SESSION_ID,
  segmentId: SEGMENT_ID,
  node,
  clarification,
  message,
  U,
  A,
} = first;

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

/** 미리보기 책장의 두 번째 책. 첫 이야기가 물건을 살지 고르는 결정이라면 이쪽은
 * 남을지 떠날지를 고르는 결정이라, 두 권이 같은 종류로 보이지 않는다.
 *
 * 노드는 둘이다. `더 배울 게 있는지`를 묻다가, 배움이 시간으로 갈리는 것이 드러나
 * `내가 시간을 어디에 쓰고 있는가`로 옮겨 간다.
 */
const second = storyParts(2);

export const exampleStorySecond: SavedStory = savedStorySchema.parse({
  session: {
    id: second.sessionId,
    origin_branch_id: null,
    started_at: "2026-09-12T21:04:00+09:00",
    completed_at: "2026-09-12T21:34:00+09:00",
    retention_decided_at: "2026-09-12T21:34:00+09:00",
    shelf_position: 2,
    shelf_revision: "1".repeat(32),
    turn_count: 6,
    node_count: 2,
  },
  initialThought: "회사를 계속 다녀야 할지 요즘 자꾸 생각해.",
  segments: [
    {
      id: second.segmentId,
      ordinal: 1,
      nodes: [
        second.node(1, "나는 여기서 더 배울 게 있는지가 걸리는 걸까?", 8),
        second.node(2, "나는 지금 시간을 어디에 쓰고 있을까?", 22),
      ],
    },
  ],
  clarifications: [
    second.clarification(1, 1, "회사가 싫어서 나가고 싶은 것은 아님"),
    second.clarification(2, 1, "배우는 자리는 새 기능을 맡을 때였음"),
    second.clarification(3, 2, "지난 반년 동안 맡은 일은 전부 고치는 일이었음"),
    second.clarification(4, 2, "새 기능을 맡으려면 먼저 손들어야 하는 자리임"),
  ],
  messages: [
    second.message(
      "USER",
      "RAW_THOUGHT",
      "회사를 계속 다녀야 할지 요즘 자꾸 생각해.",
      4,
    ),
    // 노드 1 — 나는 여기서 더 배울 게 있는지가 걸리는 걸까?
    second.A("회사를 떠올릴 때 지금 가장 걸리는 게 뭐예요?", 8),
    second.U("회사가 싫진 않아. 근데 배우는 게 없는 것 같아", 10),
    second.A("배우고 있다고 느꼈던 건 언제였어요?", 12),
    second.U("작년에 새 기능 맡았을 때", 14),
    second.A("그때랑 지금이 뭐가 달라요?", 16),
    second.U("그땐 새로 만들었고 요즘은 고치는 일만 해", 18),
    // 배움이 시간 쓰임으로 갈린다는 것이 드러난 자리.
    second.message(
      "ASSISTANT",
      "SHIFT_PROPOSAL",
      "시간을 어디에 쓰고 있는지부터 보는 건 어때요?",
      20,
    ),
    // 노드 2 — 나는 지금 시간을 어디에 쓰고 있을까?
    second.A("지난 반년 동안 맡은 일을 떠올리면 뭐가 남아요?", 22),
    second.U("거의 다 고치는 일이었어", 24),
    second.A("새로 만드는 일은 어떻게 정해져요?", 26),
    second.U("먼저 하겠다고 손들어야 해. 난 안 들었고", 28),
    second.message(
      "ASSISTANT",
      "CLOSURE",
      "다음에 새 기능이 열릴 때 손을 들어 보고 다시 보면 되겠어요.",
      30,
    ),
  ],
  offset: 0,
  hasMore: false,
});

/** 미리보기에서 책을 열 때 쓴다. 아이디가 맞지 않으면 아무것도 돌려주지 않는다 —
 *  없는 이야기를 아무거나 골라 보여 주면 책등과 내용이 어긋난다. */
export const exampleStories: Record<string, SavedStory> = {
  [exampleStory.session.id]: exampleStory,
  [exampleStorySecond.session.id]: exampleStorySecond,
};
