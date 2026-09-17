"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ActionButton } from "@seed-design/react";
import { z } from "zod";
import {
  performRetentionAction,
  RetentionActionError,
  moveSessionToPosition,
  type RetentionAction,
} from "@/lib/retention/client";
import { SavedShelf } from "./saved-shelf";
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
type Item = {
  id: string;
  text: string;
  spine: string;
  date: string;
  /** 1 (a short exchange) to 5 (a long one). Drives how big the book is. */
  size?: number;
  purgeAfter?: string;
  revision?: string;
};

/** A book's size reads as how much the conversation holds. Turns carry most of
 * the weight and the questions it passed through add to it, so a session that
 * went further looks like a thicker, taller book on the shelf.
 */
function sizeLevel(turns: number, nodes: number): number {
  const weight = turns + nodes * 2;
  if (weight <= 3) return 1;
  if (weight <= 7) return 2;
  if (weight <= 13) return 3;
  if (weight <= 21) return 4;
  return 5;
}
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
/** A spine is only as tall as the shortest book on the shelf, so the label has
 * to fit in eight upright glyphs whatever the date is. A two-digit year keeps
 * "26.10.10" within that; the full label stays on the cover. */
const spineFormat = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "2-digit",
  month: "numeric",
  day: "numeric",
});
function spineLabel(value: string): string {
  return spineFormat
    .format(new Date(value))
    .replace(/\s/g, "")
    .replace(/\.$/, "");
}

export function DrawerContents({
  initialCollection = "sessions",
}: {
  initialCollection?: Collection;
}) {
  const [collection, setCollection] = useState<Collection>(initialCollection);
  const [offset, setOffset] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<State>({ kind: "loading" });
  const mutationLock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [editingOrder, setEditingOrder] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
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
                ? "지금은 생각 더미를 연결할 수 없어요. 잠시 후 다시 확인해 주세요."
                : "생각 더미를 불러오지 못했어요. 다시 시도해 주세요.";
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
            ? {
                id: item.id,
                text: item.text,
                spine: item.text,
                date: item.kept_at,
              }
            : {
                id: item.id,
                revision:
                  "shelf_revision" in item ? item.shelf_revision : undefined,
                text: `${dateFormat.format(new Date(item.started_at))}의 이야기`,
                spine: spineLabel(item.started_at),
                ...("turn_count" in item
                  ? { size: sizeLevel(item.turn_count, item.node_count) }
                  : {}),
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
              "생각 더미를 불러오지 못했어요. 연결을 확인하고 다시 시도해 주세요.",
          });
      }
    }
    void load();
    return () => controller.abort();
  }, [collection, offset, attempt]);

  function select(value: Collection) {
    if (value === collection || mutationLock.current) return;
    setEditingOrder(false);
    setDraggedId(null);
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
            ? "생각 더미로 복원했어요."
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

  /** Each move is persisted on its own, so a shelf past one page still reorders. */
  async function moveSavedItem(itemId: string, targetIndex: number) {
    if (state.kind !== "ready" || mutationLock.current) return;
    const sourceIndex = state.items.findIndex((item) => item.id === itemId);
    if (sourceIndex < 0) return;
    const boundedTarget = Math.max(
      0,
      Math.min(targetIndex, state.items.length - 1),
    );
    if (sourceIndex === boundedTarget) return;

    const previous = state.items;
    const items = [...previous];
    const [moved] = items.splice(sourceIndex, 1);
    items.splice(boundedTarget, 0, moved);
    setState({ ...state, items });

    mutationLock.current = true;
    setBusy(true);
    setNotice(null);
    try {
      const result = await moveSessionToPosition(
        itemId,
        offset + boundedTarget + 1,
        moved.revision ?? "",
      );
      setState((current) =>
        current.kind === "ready"
          ? {
              ...current,
              items: current.items.map((item) => ({
                ...item,
                revision: result.revision,
              })),
            }
          : current,
      );
      setNotice({ text: `${result.position}번째 자리에 저장했어요.` });
    } catch (error) {
      setState((current) =>
        current.kind === "ready" ? { ...current, items: previous } : current,
      );
      setNotice(
        error instanceof RetentionActionError
          ? { text: error.message, needsLogin: error.needsLogin }
          : { text: "자리를 옮기지 못했어요. 다시 시도해 주세요." },
      );
    } finally {
      mutationLock.current = false;
      setBusy(false);
    }
  }

  function beginOrderEdit() {
    if (state.kind !== "ready" || state.items.length < 2) return;
    setNotice(null);
    setEditingOrder(true);
  }

  function endOrderEdit() {
    if (mutationLock.current) return;
    setDraggedId(null);
    setEditingOrder(false);
  }
  return (
    <section aria-label="생각 더미 내용" data-collection={collection}>
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
      {collection === "sessions" &&
        state.kind === "ready" &&
        state.items.length > 1 && (
          <div className="shelf-edit-toolbar">
            {editingOrder ? (
              <>
                <p>
                  끌어서 옮기거나 화살표로 순서를 정리해 보세요. 옮길 때마다
                  바로 저장돼요.
                </p>
                <div className="preview-actions">
                  <ActionButton
                    variant="neutralSolid"
                    disabled={busy}
                    onClick={endOrderEdit}
                  >
                    {busy ? "옮기는 중…" : "정리 마치기"}
                  </ActionButton>
                </div>
              </>
            ) : (
              <ActionButton
                variant="neutralWeak"
                disabled={busy}
                onClick={beginOrderEdit}
              >
                책장 순서 편집
              </ActionButton>
            )}
          </div>
        )}
      <div aria-live="polite" aria-busy={state.kind === "loading"}>
        {state.kind === "loading" && (
          <p className="preview-status">생각 더미를 열고 있어요…</p>
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
            collection === "sessions" && !editingOrder ? (
              <SavedShelf
                items={state.items}
                offset={offset}
                formatDate={(value) => dateFormat.format(new Date(value))}
              />
            ) : (
              <ul
                className={`drawer-list ${collection === "sessions" ? "saved-books" : ""}`}
              >
                {state.items.map((item, index) => (
                  <li
                    key={item.id}
                    className="preview-summary-card"
                    draggable={editingOrder && !busy}
                    data-order-editing={editingOrder || undefined}
                    data-dragging={draggedId === item.id || undefined}
                    onDragStart={(event) => {
                      if (!editingOrder) return;
                      setDraggedId(item.id);
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", item.id);
                    }}
                    onDragEnd={() => setDraggedId(null)}
                    onDragOver={(event) => {
                      if (!editingOrder || !draggedId) return;
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                    }}
                    onDrop={(event) => {
                      if (!editingOrder) return;
                      event.preventDefault();
                      const sourceId =
                        draggedId || event.dataTransfer.getData("text/plain");
                      if (sourceId) void moveSavedItem(sourceId, index);
                      setDraggedId(null);
                    }}
                  >
                    {editingOrder && (
                      <div className="shelf-order-controls">
                        <span className="shelf-drag-handle" aria-hidden="true">
                          ⠿
                        </span>
                        <span className="shelf-position">{index + 1}번째</span>
                        <button
                          type="button"
                          disabled={index === 0 || busy}
                          aria-label={`${item.text} 위로 이동`}
                          onClick={() => void moveSavedItem(item.id, index - 1)}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          disabled={index === state.items.length - 1 || busy}
                          aria-label={`${item.text} 아래로 이동`}
                          onClick={() => void moveSavedItem(item.id, index + 1)}
                        >
                          ↓
                        </button>
                      </div>
                    )}
                    <details className="saved-entry">
                      <summary>
                        <span className="saved-question-title">
                          {item.text}
                        </span>
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
                        {collection === "questions" && (
                          <p>
                            <Link href={`/restart/branch/${item.id}`}>
                              이 질문으로 다시 생각하기
                            </Link>
                          </p>
                        )}
                        {collection === "sessions" && (
                          <p>
                            <Link href={`/drawer/${item.id}`}>
                              이야기 펼쳐보기
                            </Link>
                          </p>
                        )}
                        <ActionButton
                          variant="neutralWeak"
                          disabled={busy || editingOrder}
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
            )
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
        disabled={busy || editingOrder || state.kind === "loading"}
        onClick={() => {
          setState({ kind: "loading" });
          setAttempt((n) => n + 1);
        }}
      >
        목록 새로고침
      </ActionButton>
      {state.kind !== "loading" && !editingOrder && (
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
