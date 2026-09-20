import assert from "node:assert/strict";
import test from "node:test";
import {
  exampleStories,
  exampleStory,
  transcriptPending,
} from "../src/lib/example/story.ts";
import { inspectReflectionQuestion } from "../src/engine/reflect.ts";
import { inspectClarification } from "../src/engine/clarification.ts";
import { replyLength } from "../src/engine/stall.ts";
import { isNonAnswer } from "../src/engine/non-answer.ts";

/** 예시 화면은 제품이 무엇을 하는지 보여 주는 유일한 자리다. 거기 실린 대화가
 *  제품의 규칙을 어기고 있으면 규칙이 아니라 예시가 거짓말을 한다. 그래서 제품이
 *  쓰는 검사기를 그대로 건다. */

const questions = exampleStory.messages.filter(
  (message) => message.role === "ASSISTANT" && message.kind === "REFLECTION",
);
const replies = exampleStory.messages.filter(
  (message) => message.role === "USER" && message.kind === "USER_REPLY",
);

test("예시가 더 이상 자리만 채우는 표본이 아니다", () => {
  assert.equal(transcriptPending, false);
  assert.ok(
    exampleStory.messages.length > 0,
    "대화가 비어 있으면 결과 칸이 0이 된다",
  );
  assert.equal(
    exampleStory.session.node_count,
    exampleStory.segments.flatMap((s) => s.nodes).length,
  );
  assert.equal(exampleStory.session.turn_count, replies.length + 1);
});

test("되묻기가 짧고 쉬운 한 문장 규칙을 지킨다", () => {
  for (const { content } of questions) {
    assert.deepEqual(
      inspectReflectionQuestion(content),
      [],
      `규칙에 걸린다: ${content}`,
    );
    // 1.5의 기준은 35자다. 진단기는 40자부터 잡으므로 여기서 따로 본다.
    assert.ok(
      replyLength(content) <= 35,
      `${replyLength(content)}자로 너무 길다: ${content}`,
    );
  }
});

test("분명해진 것이 기준·배제·확정된 사실만 담는다", () => {
  for (const { text } of exampleStory.clarifications)
    assert.deepEqual(inspectClarification(text), [], `기준에 걸린다: ${text}`);
});

test("턴마다 분명해진 것이 하나씩 생기지 않는다", () => {
  // 한 턴이 꼬박꼬박 한 항목을 낳으면 그것은 정리가 아니라 전사다(RULES 6.2).
  assert.ok(
    exampleStory.clarifications.length < replies.length,
    "항목 수가 사용자 발화 수에 붙어 있다",
  );
});

test("사용자 발화가 전부 재료를 담고 있다", () => {
  for (const { content } of replies)
    assert.equal(
      isNonAnswer([{ role: "user", text: content }]),
      false,
      content,
    );
});

test("마친 시각이 마지막 발화보다 뒤다", () => {
  const last = exampleStory.messages.at(-1);
  assert.ok(last);
  assert.ok(
    new Date(exampleStory.session.completed_at) >= new Date(last.created_at),
    "이야기가 끝난 뒤에 말이 더 붙어 있다",
  );
});

test("노드가 하나씩 좁혀진다", () => {
  const nodes = exampleStory.segments.flatMap((segment) => segment.nodes);
  assert.ok(nodes.length >= 3, "노드가 생기는 모습을 보여 주지 못한다");
  // 뒤 질문일수록 앞 질문의 답을 대신할 수 있어야 한다. 순서가 곧 좁혀짐이다.
  assert.deepEqual(
    nodes.map((node) => node.ordinal),
    nodes.map((_, index) => index + 1),
  );
  for (const node of nodes)
    assert.ok(node.final_text.endsWith("?"), node.final_text);
});

/** 두 번째 책도 같은 검사기를 통과해야 한다. 미리보기 책장에서 두 권 다 열린다. */
test("미리보기의 모든 이야기가 같은 규칙을 지킨다", () => {
  const ids = Object.keys(exampleStories);
  assert.ok(
    ids.length >= 2,
    "책장에 책이 둘인데 이야기가 하나면 하나는 열리지 않는다",
  );
  for (const [id, story] of Object.entries(exampleStories)) {
    assert.equal(story.session.id, id, "키와 세션 아이디가 어긋난다");
    const asked = story.messages.filter(
      (m) => m.role === "ASSISTANT" && m.kind === "REFLECTION",
    );
    for (const { content } of asked) {
      assert.deepEqual(inspectReflectionQuestion(content), [], content);
      assert.ok(
        replyLength(content) <= 35,
        `${replyLength(content)}자: ${content}`,
      );
    }
    for (const { text } of story.clarifications)
      assert.deepEqual(inspectClarification(text), [], text);
    const said = story.messages.filter(
      (m) => m.role === "USER" && m.kind === "USER_REPLY",
    );
    for (const { content } of said)
      assert.equal(
        isNonAnswer([{ role: "user", text: content }]),
        false,
        content,
      );
    assert.ok(story.clarifications.length < said.length + 1, id);
    assert.equal(story.session.turn_count, said.length + 1, id);
    assert.equal(
      story.session.node_count,
      story.segments.flatMap((segment) => segment.nodes).length,
      id,
    );
    const last = story.messages.at(-1);
    assert.ok(
      last && new Date(story.session.completed_at) >= new Date(last.created_at),
      id,
    );
  }
});

test("두 이야기가 아이디를 나눠 쓴다", () => {
  // 한 틀에서 찍어 내므로 seed가 어긋나면 노드·발화 아이디가 겹친다.
  const all = Object.values(exampleStories).flatMap((story) => [
    story.session.id,
    ...story.segments.map((segment) => segment.id),
    ...story.segments.flatMap((segment) => segment.nodes.map((n) => n.id)),
    ...story.clarifications.map((item) => item.id),
    ...story.messages.map((message) => message.id),
  ]);
  assert.equal(new Set(all).size, all.length, "아이디가 겹친다");
});
