"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import type { SavedStory } from "@/schemas/saved-story";

/** 보관한 이야기를 다시 여는 자리.
 *
 * 요약만 보여 주고 있었다. 질문 카드를 한 장씩 넘기면 중심 질문과 분명해진 것은
 * 읽히는데, 정작 **나눈 말은 어디에도 없었다.** 다시 열어 보는 사람이 확인하려는 것은
 * "이런 대화를 나눴었지"이므로 대화 그대로가 본문이 된다.
 *
 * 틀은 대화 화면과 같다 — 왼쪽에 주고받은 말, 오른쪽에 질문 지도와 분명해진 것.
 * 읽기 전용 버전이라 새 화면이 아니고, 그래서 대화하던 기억과 여는 기억이 같은
 * 모양으로 남는다.
 */
/** 마친 날은 날짜까지만 쓴다. 몇 시에 끝냈는지는 다시 열어 보는 사람에게 필요 없다. */
function formatStoryDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

export function StoryReader({
  story,
  restartable = true,
}: {
  story: SavedStory;
  restartable?: boolean;
}) {
  const nodes = story.segments.flatMap((segment) =>
    segment.nodes.map((node) => ({ node, segment })),
  );
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const elements = useRef(new Map<string, HTMLLIElement>());

  function goToNode(nodeId: string, messageId: string | null) {
    if (activeNodeId === nodeId) {
      setActiveNodeId(null);
      return;
    }
    setActiveNodeId(nodeId);
    const element = messageId ? elements.current.get(messageId) : null;
    if (!element) return;
    element.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "center",
    });
    element.focus({ preventScroll: true });
  }
  const viewingMessageId = activeNodeId
    ? (nodes.find((c) => c.node.id === activeNodeId)?.node.birth_message_id ??
      null)
    : null;
  const current = nodes.find((c) => c.node.id === activeNodeId) ?? nodes[0];
  if (!current) return <p>이 페이지에 남겨진 중심 질문이 없어요.</p>;
  // 노드를 고르지 않았으면 이야기 전체의 결과를 보여 준다. 마친 이야기를 다시
  // 여는 사람이 먼저 확인하려는 것은 "이 대화로 무엇이 남았나"이지 특정 노드의
  // 한 조각이 아니다. 노드를 고르면 그 자리의 것만 좁혀 보여 준다.
  const shown = activeNodeId
    ? story.clarifications.filter((item) => item.node_id === activeNodeId)
    : story.clarifications;
  const arrived = nodes.at(-1)?.node ?? current.node;
  const spoken = story.messages.filter(
    (message) => message.kind !== "SYSTEM_NOTICE",
  ).length;

  return (
    <div className="conversation-layout story-layout">
      <div className="conversation-stream">
        {story.messages.length ? (
          <ol className="drawer-list" aria-label="나눈 대화">
            {story.messages.map((message) => (
              <li
                key={message.id}
                className="preview-summary-card conversation-card"
                data-role={message.role}
                data-viewing={
                  viewingMessageId === message.id ? "true" : undefined
                }
                tabIndex={-1}
                ref={(element) => {
                  if (element) elements.current.set(message.id, element);
                  else elements.current.delete(message.id);
                }}
              >
                <small>
                  {message.role === "USER" ? "내 이야기" : "누크의 질문"}
                </small>
                <p className="conversation-message">{message.content}</p>
              </li>
            ))}
          </ol>
        ) : (
          /* 발화 없이 질문만 남은 기록(표본 화면 포함)에서는 질문을 본문으로 둔다. */
          <ol className="drawer-list" aria-label="지나온 질문">
            {nodes.map(({ node, segment }) => (
              <li
                key={node.id}
                className="preview-summary-card conversation-card"
                data-role="ASSISTANT"
              >
                <small>
                  {segment.ordinal}번째 구간 · 질문 {node.ordinal}
                </small>
                <p className="conversation-message">{node.final_text}</p>
              </li>
            ))}
          </ol>
        )}
      </div>

      <aside className="conversation-side">
        {/* 마친 이야기는 읽는 목적이 다르다. 이어갈 자리를 찾는 것이 아니라 무엇이
            남았는지 확인하러 온다. 그래서 길잡이보다 결과를 먼저 둔다. */}
        <section className="story-result" aria-label="이 이야기의 결과">
          <p className="story-result-badge">마친 이야기</p>
          <h2>{arrived.final_text}</h2>
          <p className="story-result-lede">
            {nodes.length > 1
              ? `질문 ${nodes.length}개를 지나 여기까지 왔어요.`
              : "이 질문 하나로 마쳤어요."}
          </p>
          <dl className="story-result-facts">
            <div>
              <dt>주고받은 말</dt>
              <dd>{spoken}번</dd>
            </div>
            <div>
              <dt>분명해진 것</dt>
              <dd>{story.clarifications.length}개</dd>
            </div>
            <div>
              <dt>마친 날</dt>
              <dd>{formatStoryDate(story.session.completed_at)}</dd>
            </div>
          </dl>
        </section>
        <nav className="node-navigation" aria-label="지나온 질문 이동">
          <div className="node-navigation-heading">
            <strong>지나온 질문</strong>
            <small>
              {activeNodeId
                ? "이 질문이 생긴 자리를 보고 있어요. 다시 누르면 풀려요."
                : "질문을 누르면 그 질문이 생긴 자리로 가요."}
            </small>
          </div>
          <ol>
            {nodes.map(({ node }, index) => (
              <li key={node.id}>
                <button
                  type="button"
                  data-active={activeNodeId === node.id}
                  aria-pressed={activeNodeId === node.id}
                  onClick={() => goToNode(node.id, node.birth_message_id)}
                >
                  <span>{index + 1}</span>
                  <span>{node.final_text}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>
        {shown.length > 0 && (
          <section className="clarity-panel" aria-label="분명해진 것">
            <h2>분명해진 것</h2>
            <small>
              {activeNodeId
                ? "고른 질문에서 분명해진 것만 보고 있어요."
                : "이 이야기 전체에서 분명해진 것이에요."}
            </small>
            <ul>
              {shown.map((item) => (
                <li key={item.id}>{item.text}</li>
              ))}
            </ul>
          </section>
        )}
        {restartable && (
          <p className="story-restart">
            <Link href={`/restart/node/${current.node.id}`}>
              이 질문으로 다시 생각하기 ›
            </Link>
          </p>
        )}
      </aside>
    </div>
  );
}
