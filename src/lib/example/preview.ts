import {
  conversationViewSchema,
  type ConversationView,
} from "@/schemas/conversation";

/** 홈의 미리보기가 쓰는 표본.
 *
 * 홈에서 토글 하나로 켜면 책장·이어갈 대화·대화 화면이 모두 이 값을 읽는다. DB도
 * 모델도 건드리지 않고, 실제 컴포넌트에 고정 데이터만 주입한다 — 미리보기 전용
 * 화면을 따로 만들면 제품과 어긋나기 때문이다.
 *
 * `story.ts`의 노트북 이야기와 같은 줄기를 쓴다. 두 곳이 다른 이야기를 하면 미리보기를
 * 켠 사람이 화면마다 다른 제품을 보게 된다.
 */
const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const NODE_ID = "33333333-3333-4333-8333-333333333302";
const id = (n: number) =>
  `55555555-5555-4555-8555-5555555555${String(n).padStart(2, "0")}`;

/** 미리보기에서 열리는 대화의 nodeId. 주소에 실려 화면이 표본을 찾는 열쇠가 된다. */
export const PREVIEW_NODE_ID = NODE_ID;

export const previewConversation: ConversationView =
  conversationViewSchema.parse({
    sessionId: SESSION_ID,
    version: 4,
    mode: "READY",
    currentQuestion: "나는 노트북으로 무엇을 하려고 하는가?",
    nodes: [
      {
        id: "33333333-3333-4333-8333-333333333301",
        question: "노트북을 살까?",
        messageId: id(1),
        current: false,
      },
      {
        id: NODE_ID,
        question: "나는 노트북으로 무엇을 하려고 하는가?",
        messageId: id(4),
        current: true,
      },
    ],
    pending: null,
    messages: [
      {
        id: id(1),
        role: "USER",
        content:
          "노트북 살까 말까 계속 고민 중이야. 사놓고 잘 못 쓸 것 같아서 결정을 못 하겠어.",
      },
      {
        id: id(2),
        role: "ASSISTANT",
        content: "잘 못 쓸 것 같다는 생각은 어떤 장면을 떠올릴 때 들어요?",
      },
      {
        id: id(3),
        role: "USER",
        content:
          "예전에 태블릿 샀을 때도 처음 한 달만 쓰고 서랍에 넣어뒀거든. 그게 자꾸 생각나.",
      },
      {
        id: id(4),
        role: "ASSISTANT",
        content: "노트북으로 하려던 일 중에 지금도 하고 싶은 건 뭐예요?",
      },
    ],
    clarifications: [
      { id: id(11), text: "돈이 부담인 것은 아님" },
      { id: id(12), text: "지금 하고 싶은 작업이 뚜렷하지는 않음" },
    ],
    branches: [],
    contact: null,
  });

/** 홈 책장에 놓이는 표본 책. */
export const previewBooks = [
  {
    id: SESSION_ID,
    title: "지금 사는 것이 그걸 실제로 시작하게 만들까?",
    nodes: 3,
  },
  {
    id: "11111111-1111-4111-8111-111111111112",
    title: "나는 여기서 더 배울 게 있는지가 걸리는 걸까?",
    nodes: 2,
  },
];

/** 표본의 만료 시각. `Date.now()`로 지으면 서버와 클라이언트가 다른 글자를 그려
 *  하이드레이션이 어긋난다. 고정값이라 미리보기는 늘 같은 화면이다. */
export const PREVIEW_EXPIRES_AT = "2026-09-20T18:00:00+09:00";

/** 홈의 이어갈 대화에 놓이는 표본. */
export const previewRecovery = [
  {
    id: SESSION_ID,
    nodeId: NODE_ID,
    question: "나는 노트북으로 무엇을 하려고 하는가?",
  },
];
