"use client";
import { useState } from "react";
import Link from "next/link";
import type { SavedStory } from "@/schemas/saved-story";
import { CardNavigation } from "./card-navigation";

export function StoryReader({ story }: { story: SavedStory }) {
  const cards = story.segments.flatMap((segment) =>
    segment.nodes.map((node) => ({ node, segment })),
  );
  const [index, setIndex] = useState(0);
  const current = cards[index];
  if (!current) return <p>이 페이지에 남겨진 중심 질문이 없어요.</p>;
  const previous = index > 0 ? () => setIndex(index - 1) : undefined;
  const next = index < cards.length - 1 ? () => setIndex(index + 1) : undefined;
  return (
    <div className="story-reader">
      <nav className="story-index" aria-label="이야기 목차">
        {story.segments
          .filter((segment) => segment.nodes.length)
          .map((segment) => (
            <section key={segment.id}>
              <h2>{segment.ordinal}번째 구간</h2>
              <ol>
                {segment.nodes.map((node) => (
                  <li key={node.id}>
                    <button
                      type="button"
                      aria-current={
                        node.id === current.node.id ? "step" : undefined
                      }
                      onClick={() =>
                        setIndex(
                          cards.findIndex((card) => card.node.id === node.id),
                        )
                      }
                    >
                      {node.final_text}
                    </button>
                  </li>
                ))}
              </ol>
            </section>
          ))}
      </nav>
      <CardNavigation
        label="질문 카드 · 좌우 방향키로 이동"
        previous={previous}
        next={next}
      >
        <article className="story-question-card" key={current.node.id}>
          <p>
            {current.segment.ordinal}번째 구간 · 질문 {current.node.ordinal}
          </p>
          <h2>{current.node.final_text}</h2>
          {story.clarifications.some(
            (item) => item.node_id === current.node.id,
          ) && (
            <section>
              <h3>함께 분명해진 것</h3>
              <ul>
                {story.clarifications
                  .filter((item) => item.node_id === current.node.id)
                  .map((item) => (
                    <li key={item.id}>{item.text}</li>
                  ))}
              </ul>
            </section>
          )}
          <Link href={`/restart/node/${current.node.id}`}>
            이 질문으로 다시 생각하기
          </Link>
        </article>
        <div className="card-controls">
          <button disabled={!previous} onClick={previous}>
            이전 질문
          </button>
          <span role="status">
            {index + 1} / {cards.length}
            <span className="sr-only"> · {current.node.final_text}</span>
          </span>
          <button disabled={!next} onClick={next}>
            다음 질문
          </button>
        </div>
      </CardNavigation>
    </div>
  );
}
