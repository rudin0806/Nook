"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ActionButton } from "@seed-design/react";
import { savedStorySchema, type SavedStory } from "@/schemas/saved-story";
type State =
  | { kind: "loading" }
  | { kind: "error"; message: string; login: boolean }
  | { kind: "ready"; story: SavedStory };
export function SavedStoryContents({ sessionId }: { sessionId: string }) {
  const [offset, setOffset] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<State>({ kind: "loading" });
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(
          `/api/sessions/${sessionId}/story?offset=${offset}`,
          {
            credentials: "same-origin",
            cache: "no-store",
            signal: controller.signal,
          },
        );
        if (!response.ok) {
          if (!controller.signal.aborted)
            setState({
              kind: "error",
              login: response.status === 401,
              message:
                response.status === 401
                  ? "이야기를 보려면 계정을 연결해 주세요."
                  : response.status === 404
                    ? "보관 중인 이야기를 찾을 수 없어요. 휴지통으로 옮겼다면 먼저 복원해 주세요."
                    : "이야기를 불러오지 못했어요. 잠시 후 다시 확인해 주세요.",
            });
          return;
        }
        const payload: unknown = await response.json();
        const story = savedStorySchema.parse(
          (payload as { data?: unknown })?.data,
        );
        if (story.session.id !== sessionId || story.offset !== offset)
          throw new Error("INVALID_RESPONSE");
        if (!controller.signal.aborted) setState({ kind: "ready", story });
      } catch {
        if (!controller.signal.aborted)
          setState({
            kind: "error",
            login: false,
            message: "이야기를 불러오지 못했어요. 연결을 확인해 주세요.",
          });
      }
    })();
    return () => controller.abort();
  }, [sessionId, offset, attempt]);
  function page(next: number) {
    setState({ kind: "loading" });
    setOffset(next);
  }
  return (
    <section
      aria-label="보관한 이야기"
      aria-live="polite"
      aria-busy={state.kind === "loading"}
    >
      {state.kind === "loading" && <p>지나온 질문을 펼치고 있어요…</p>}
      {state.kind === "error" && (
        <div role="alert">
          <p>{state.message}</p>
          {state.login && (
            <p>
              <Link href="/login">계정 연결하기</Link>
            </p>
          )}
          <ActionButton
            variant="neutralWeak"
            onClick={() => {
              setState({ kind: "loading" });
              setAttempt((n) => n + 1);
            }}
          >
            다시 확인하기
          </ActionButton>
        </div>
      )}
      {state.kind === "ready" && (
        <>
          <p>
            {new Date(state.story.session.started_at).toLocaleDateString(
              "ko-KR",
              { timeZone: "Asia/Seoul" },
            )}
            에 시작한 이야기
          </p>
          {!state.story.segments.some((s) => s.nodes.length) && (
            <p>이 페이지에 남겨진 중심 질문이 없어요.</p>
          )}
          {state.story.initialThought && (
            <section aria-label="처음 적은 생각">
              <h2>처음 적은 생각</h2>
              <p>첫 질문을 확정하기 전에 남긴 기록이에요.</p>
              <p className="conversation-message">
                {state.story.initialThought}
              </p>
              <Link href={`/restart/session/${state.story.session.id}`}>
                이 생각으로 다시 시작하기
              </Link>
            </section>
          )}
          {state.story.segments.map((segment) => (
            <section
              key={segment.id}
              aria-label={`${segment.ordinal}번째 구간`}
            >
              <h2>{segment.ordinal}번째 구간</h2>
              <ol className="drawer-list">
                {segment.nodes.map((node) => (
                  <li key={node.id} className="preview-summary-card">
                    <h3>{node.final_text}</h3>
                    <Link href={`/restart/node/${node.id}`}>
                      이 질문으로 다시 생각하기
                    </Link>
                    {state.story.clarifications.some(
                      (c) => c.node_id === node.id,
                    ) && (
                      <>
                        <p>함께 분명해진 것</p>
                        <ul>
                          {state.story.clarifications
                            .filter((c) => c.node_id === node.id)
                            .map((c) => (
                              <li key={c.id}>{c.text}</li>
                            ))}
                        </ul>
                      </>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          ))}
          <div className="preview-actions">
            {offset > 0 && (
              <ActionButton
                variant="ghost"
                onClick={() => page(Math.max(0, offset - 10))}
              >
                이전 구간
              </ActionButton>
            )}
            {state.story.hasMore && (
              <ActionButton variant="ghost" onClick={() => page(offset + 10)}>
                다음 구간
              </ActionButton>
            )}
          </div>
        </>
      )}
    </section>
  );
}
