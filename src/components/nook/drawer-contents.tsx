"use client";

import { useEffect, useState } from "react";
import { ActionButton } from "@seed-design/react";
import { z } from "zod";
import {
  savedSessionListItemSchema,
  keptBranchQuestionListItemSchema,
} from "@/schemas/retention";

type Collection = "sessions" | "questions";
const paging = {
  hasMore: z.boolean(),
  offset: z.number().int(),
  limit: z.number().int(),
};
const sessionsResponse = z.object({
  data: z.object({ ...paging, items: savedSessionListItemSchema.array() }),
});
const questionsResponse = z.object({
  data: z.object({
    ...paging,
    items: keptBranchQuestionListItemSchema.array(),
  }),
});
type Item = { id: string; text: string; date: string };
type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; items: Item[]; hasMore: boolean };
const dateFormat = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "long",
  day: "numeric",
});

export function DrawerContents() {
  const [collection, setCollection] = useState<Collection>("sessions");
  const [offset, setOffset] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<State>({ kind: "loading" });
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const url =
          collection === "sessions"
            ? `/api/sessions?collection=saved&limit=20&offset=${offset}`
            : `/api/branch-questions?limit=20&offset=${offset}`;
        const response = await fetch(url, {
          signal: controller.signal,
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!response.ok) {
          const message =
            response.status === 401
              ? "서랍을 보려면 로그인이 필요해요. 로그인 기능은 준비 중이에요."
              : response.status === 503
                ? "지금은 서랍을 연결할 수 없어요. 잠시 후 다시 확인해 주세요."
                : "서랍을 불러오지 못했어요. 다시 시도해 주세요.";
          if (!controller.signal.aborted) setState({ kind: "error", message });
          return;
        }
        const payload: unknown = await response.json();
        const data =
          collection === "sessions"
            ? sessionsResponse.parse(payload).data
            : questionsResponse.parse(payload).data;
        const items = data.items.map((item) =>
          "text" in item
            ? { id: item.id, text: item.text, date: item.kept_at }
            : {
                id: item.id,
                text: `${dateFormat.format(new Date(item.started_at))}의 이야기`,
                date: item.retention_decided_at,
              },
        );
        if (!controller.signal.aborted)
          setState({ kind: "ready", items, hasMore: data.hasMore });
      } catch {
        if (!controller.signal.aborted)
          setState({
            kind: "error",
            message:
              "서랍을 불러오지 못했어요. 연결을 확인하고 다시 시도해 주세요.",
          });
      }
    }
    void load();
    return () => controller.abort();
  }, [collection, offset, attempt]);

  function select(value: Collection) {
    if (value === collection) return;
    setState({ kind: "loading" });
    setOffset(0);
    setCollection(value);
  }
  function page(next: number) {
    setState({ kind: "loading" });
    setOffset(next);
  }
  return (
    <section aria-label="서랍 내용">
      <div className="preview-actions" role="group" aria-label="보관 종류">
        <ActionButton
          variant={collection === "sessions" ? "neutralSolid" : "neutralWeak"}
          aria-pressed={collection === "sessions"}
          onClick={() => select("sessions")}
        >
          보관한 이야기
        </ActionButton>
        <ActionButton
          variant={collection === "questions" ? "neutralSolid" : "neutralWeak"}
          aria-pressed={collection === "questions"}
          onClick={() => select("questions")}
        >
          남겨둔 질문
        </ActionButton>
      </div>
      <div aria-live="polite" aria-busy={state.kind === "loading"}>
        {state.kind === "loading" && (
          <p className="preview-status">서랍을 열고 있어요…</p>
        )}
        {state.kind === "error" && (
          <div className="preview-summary-card">
            <p>{state.message}</p>
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
        {state.kind === "ready" &&
          (state.items.length ? (
            <ul className="drawer-list">
              {state.items.map((item) => (
                <li key={item.id} className="preview-summary-card">
                  <p>{item.text}</p>
                  <small>{dateFormat.format(new Date(item.date))}에 보관</small>
                </li>
              ))}
            </ul>
          ) : (
            <div className="preview-summary-card">
              <h2>
                {offset
                  ? "이 페이지에는 기록이 없어요."
                  : collection === "sessions"
                    ? "아직 넣어둔 이야기가 없어요."
                    : "아직 남겨둔 질문이 없어요."}
              </h2>
              <p>보관하기로 고른 내용이 여기에 모여요.</p>
            </div>
          ))}
      </div>
      {state.kind !== "loading" && (
        <div className="preview-actions">
          {offset > 0 && (
            <ActionButton
              variant="ghost"
              onClick={() => page(Math.max(0, offset - 20))}
            >
              이전
            </ActionButton>
          )}
          {state.kind === "ready" && state.hasMore && (
            <ActionButton variant="ghost" onClick={() => page(offset + 20)}>
              다음
            </ActionButton>
          )}
        </div>
      )}
    </section>
  );
}
