"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ActionButton } from "@seed-design/react";
import { z } from "zod";
import {
  performRetentionAction,
  RetentionActionError,
  type RetentionAction,
} from "@/lib/retention/client";
import {
  savedSessionListItemSchema,
  trashedSessionListItemSchema,
  keptBranchQuestionListItemSchema,
} from "@/schemas/retention";

type Collection = "sessions" | "questions" | "trash";
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
const trashResponse = z.object({
  data: z.object({ ...paging, items: trashedSessionListItemSchema.array() }),
});
type Item = { id: string; text: string; date: string; purgeAfter?: string };
type State =
  | { kind: "loading" }
  | { kind: "error"; message: string; needsLogin?: boolean }
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
  const mutationLock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{
    text: string;
    needsLogin?: boolean;
  } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const url =
          collection === "questions"
            ? `/api/branch-questions?limit=20&offset=${offset}`
            : `/api/sessions?collection=${collection === "trash" ? "trash" : "saved"}&limit=20&offset=${offset}`;
        const response = await fetch(url, {
          signal: controller.signal,
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!response.ok) {
          const message =
            response.status === 401
              ? "보관한 이야기를 보려면 계정을 연결해 주세요."
              : response.status === 503
                ? "지금은 생각더미를 연결할 수 없어요. 잠시 후 다시 확인해 주세요."
                : "생각더미를 불러오지 못했어요. 다시 시도해 주세요.";
          if (!controller.signal.aborted)
            setState({
              kind: "error",
              message,
              needsLogin: response.status === 401,
            });
          return;
        }
        const payload: unknown = await response.json();
        const data =
          collection === "sessions"
            ? sessionsResponse.parse(payload).data
            : collection === "trash"
              ? trashResponse.parse(payload).data
              : questionsResponse.parse(payload).data;
        const items = data.items.map((item) =>
          "text" in item
            ? { id: item.id, text: item.text, date: item.kept_at }
            : {
                id: item.id,
                text: `${dateFormat.format(new Date(item.started_at))}의 이야기`,
                date:
                  "trashed_at" in item
                    ? item.trashed_at
                    : item.retention_decided_at,
                purgeAfter:
                  "purge_after" in item ? item.purge_after : undefined,
              },
        );
        if (!controller.signal.aborted)
          setState({ kind: "ready", items, hasMore: data.hasMore });
      } catch {
        if (!controller.signal.aborted)
          setState({
            kind: "error",
            message:
              "생각더미를 불러오지 못했어요. 연결을 확인하고 다시 시도해 주세요.",
          });
      }
    }
    void load();
    return () => controller.abort();
  }, [collection, offset, attempt]);

  function select(value: Collection) {
    if (value === collection || mutationLock.current) return;
    setNotice(null);
    setState({ kind: "loading" });
    setOffset(0);
    setCollection(value);
  }
  function page(next: number) {
    if (mutationLock.current) return;
    setState({ kind: "loading" });
    setOffset(next);
  }
  async function act(item: Item) {
    if (mutationLock.current) return;
    const action: RetentionAction =
      collection === "trash"
        ? "restore"
        : collection === "questions"
          ? "delete-question"
          : "trash";
    const question =
      action === "delete-question"
        ? "이 질문을 영구 삭제할까요? 삭제한 질문은 복원할 수 없어요. 이 질문에서 시작한 다른 이야기는 유지돼요."
        : "이 이야기를 휴지통으로 옮길까요? 7일 동안 복원할 수 있어요. 별도로 보관한 질문은 유지돼요.";
    if (action !== "restore" && !window.confirm(question)) return;
    mutationLock.current = true;
    setBusy(true);
    setNotice(null);
    try {
      await performRetentionAction(action, item.id);
      setNotice({
        text:
          action === "restore"
            ? "생각더미로 복원했어요."
            : action === "trash"
              ? "휴지통으로 옮겼어요."
              : "질문을 삭제했어요.",
      });
      setState({ kind: "loading" });
      setOffset(0);
      setAttempt((n) => n + 1);
    } catch (error) {
      setNotice(
        error instanceof RetentionActionError
          ? { text: error.message, needsLogin: error.needsLogin }
          : {
              text: "처리 결과를 확인하지 못했어요. 다시 누르기 전에 목록을 새로고침해 주세요.",
            },
      );
    } finally {
      mutationLock.current = false;
      setBusy(false);
    }
  }
  return (
    <section aria-label="생각더미 내용">
      <div className="preview-actions" role="group" aria-label="보관 종류">
        <ActionButton
          variant={collection === "sessions" ? "neutralSolid" : "neutralWeak"}
          disabled={busy}
          aria-pressed={collection === "sessions"}
          onClick={() => select("sessions")}
        >
          보관한 이야기
        </ActionButton>
        <ActionButton
          variant={collection === "questions" ? "neutralSolid" : "neutralWeak"}
          disabled={busy}
          aria-pressed={collection === "questions"}
          onClick={() => select("questions")}
        >
          남겨둔 질문
        </ActionButton>
        <ActionButton
          variant={collection === "trash" ? "neutralSolid" : "neutralWeak"}
          disabled={busy}
          aria-pressed={collection === "trash"}
          onClick={() => select("trash")}
        >
          휴지통
        </ActionButton>
      </div>
      {notice && (
        <div role="status">
          <p>{notice.text}</p>
          {notice.needsLogin && <Link href="/login">계정 다시 연결하기</Link>}
        </div>
      )}
      {collection === "trash" && (
        <p>휴지통으로 옮긴 이야기는 7일 동안 복원할 수 있어요.</p>
      )}
      <div aria-live="polite" aria-busy={state.kind === "loading"}>
        {state.kind === "loading" && (
          <p className="preview-status">생각더미를 열고 있어요…</p>
        )}
        {state.kind === "error" && (
          <div className="preview-summary-card">
            <p>{state.message}</p>
            {state.needsLogin && (
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
        {state.kind === "ready" &&
          (state.items.length ? (
            <ul
              className={`drawer-list ${collection === "sessions" ? "saved-books" : ""}`}
            >
              {state.items.map((item) => (
                <li key={item.id} className="preview-summary-card">
                  <details className="saved-entry">
                    <summary>
                      <span className="saved-question-title">{item.text}</span>
                    </summary>
                    <small>
                      {dateFormat.format(new Date(item.date))}에{" "}
                      {collection === "trash" ? "휴지통으로 이동" : "보관"}
                    </small>
                    {item.purgeAfter && (
                      <p>
                        복원 기한:{" "}
                        {new Date(item.purgeAfter).toLocaleString("ko-KR", {
                          timeZone: "Asia/Seoul",
                        })}{" "}
                        (한국 시간)
                      </p>
                    )}
                    <div>
                      <ActionButton
                        variant="neutralWeak"
                        disabled={busy}
                        onClick={() => void act(item)}
                      >
                        {busy
                          ? "처리 중…"
                          : collection === "trash"
                            ? "복원하기"
                            : collection === "questions"
                              ? "질문 삭제"
                              : "휴지통으로 이동"}
                      </ActionButton>
                    </div>
                  </details>
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
                    : collection === "trash"
                      ? "휴지통이 비어 있어요."
                      : "아직 남겨둔 질문이 없어요."}
              </h2>
              <p>
                {collection === "trash"
                  ? "휴지통으로 옮긴 이야기가 여기에 모여요."
                  : "보관하기로 고른 내용이 여기에 모여요."}
              </p>
            </div>
          ))}
      </div>
      <ActionButton
        variant="ghost"
        disabled={busy || state.kind === "loading"}
        onClick={() => {
          setState({ kind: "loading" });
          setAttempt((n) => n + 1);
        }}
      >
        목록 새로고침
      </ActionButton>
      {state.kind !== "loading" && (
        <div className="preview-actions">
          {offset > 0 && (
            <ActionButton
              variant="ghost"
              disabled={busy}
              onClick={() => page(Math.max(0, offset - 20))}
            >
              이전
            </ActionButton>
          )}
          {state.kind === "ready" && state.hasMore && (
            <ActionButton
              variant="ghost"
              disabled={busy}
              onClick={() => page(offset + 20)}
            >
              다음
            </ActionButton>
          )}
        </div>
      )}
    </section>
  );
}
