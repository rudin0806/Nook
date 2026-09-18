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
import { EmptyArt } from "./empty-art";
import { recoveryPageSchema } from "@/schemas/recovery";
import { RetentionCard } from "./retention-card";
import {
  savedSessionListItemSchema,
  trashedSessionListItemSchema,
} from "@/schemas/retention";

/** 곁가지 질문은 여기 없다. 대화가 갈라진 자리에서만 보이고 별도 진입점을 두지
 * 않는 것이 제작 의도이며, 그 질문에서 실제로 대화를 시작했다면 그 세션이
 * `recovery`로 올라온다. */
type Collection = "sessions" | "recovery" | "trash";
const paging = {
  hasMore: z.boolean(),
  offset: z.number().int(),
  limit: z.number().int(),
};
const sessionsResponse = z.object({
  data: z.object({ ...paging, items: savedSessionListItemSchema.array() }),
});
const recoveryResponse = z.object({ data: recoveryPageSchema });
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

/** Each tab draws its own thing: books for stories, stacked cards for the
 * questions kept for later, a bin for the bin. */
function emptyArtKind(collection: Collection) {
  return collection === "sessions"
    ? "books"
    : collection === "trash"
      ? "trash"
      : "questions";
}

function signedOutHint(collection: Collection) {
  return collection === "sessions"
    ? "로그인하면 남긴 이야기가 여기 한 권씩 쌓여요."
    : collection === "trash"
      ? "지운 기록은 7일 동안 여기서 되돌릴 수 있어요."
      : "아직 마치지 않은 대화를 24시간 안에 여기서 이어갈 수 있어요.";
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
          collection === "recovery"
            ? `/api/recovery?limit=20&offset=${offset}`
            : `/api/sessions?collection=${collection === "trash" ? "trash" : "saved"}&limit=20&offset=${offset}`;
        const response = await fetch(url, {
          signal: controller.signal,
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!response.ok) {
          const message =
            response.status === 401
              ? "로그인하면 남긴 이야기와 질문을 여기서 볼 수 있어요."
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
              : recoveryResponse.parse(payload).data;
        const items = data.items.map((item) =>
          // The same rows the home panel shows, read through this list's shape.
          "expiresAt" in item
            ? {
                id: item.id,
                text: item.question,
                spine: item.question,
                date: item.expiresAt,
                nodeId: item.nodeId,
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
      collection === "trash" ? "restore" : "trash";
    const question =
      "이 이야기를 휴지통으로 옮길까요? 7일 동안 복원할 수 있어요.";
    if (action !== "restore" && !window.confirm(question)) return;
    mutationLock.current = true;
    setBusy(true);
    setNotice(null);
    try {
      await performRetentionAction(action, item.id);
      setNotice({
        text:
          action === "restore"
            ? "내 서랍으로 복원했어요."
            : "휴지통으로 옮겼어요.",
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
          내 서랍
        </ActionButton>
        <ActionButton
          variant={collection === "recovery" ? "neutralSolid" : "neutralWeak"}
          disabled={busy}
          aria-pressed={collection === "recovery"}
          onClick={() => select("recovery")}
        >
          이어갈 대화
        </ActionButton>
        <ActionButton
          variant={collection === "trash" ? "neutralSolid" : "neutralWeak"}
          disabled={busy}
          aria-pressed={collection === "trash"}
          onClick={() => select("trash")}
        >
          휴지통
        </ActionButton>
        {/* 목록을 다시 읽는 일은 탭을 고르는 일과 같은 줄에 있다. 아래에 글씨로
            놓여 있을 때는 이 화면의 마지막 동작처럼 보였고, 무엇을 새로고침하는지도
            탭에서 멀어 알기 어려웠다. */}
        <button
          type="button"
          className="collection-refresh"
          aria-label="목록 새로고침"
          title="목록 새로고침"
          disabled={busy || editingOrder || state.kind === "loading"}
          onClick={() => {
            setState({ kind: "loading" });
            setAttempt((n) => n + 1);
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
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
      {collection === "recovery" && (
        <p>홈에서 보던 그 목록이에요. 24시간 안에 이어갈 수 있어요.</p>
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
          <div
            className="collection-empty"
            role={state.needsLogin ? undefined : "alert"}
          >
            <EmptyArt kind={emptyArtKind(collection)} />
            <strong>
              {state.needsLogin
                ? "계정을 연결하면 열려요"
                : "지금은 열 수 없어요"}
            </strong>
            <p>
              {state.needsLogin ? signedOutHint(collection) : state.message}
            </p>
            {state.needsLogin ? (
              <Link className="shelf-cta" href="/login">
                계정 연결하기
              </Link>
            ) : (
              <ActionButton
                variant="neutralWeak"
                onClick={() => {
                  setState({ kind: "loading" });
                  setAttempt((n) => n + 1);
                }}
              >
                다시 확인하기
              </ActionButton>
            )}
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
                    <RetentionCard
                      item={item}
                      collection={collection}
                      busy={busy}
                      disabled={editingOrder}
                      formatDate={(value) => dateFormat.format(new Date(value))}
                      onAct={() => void act(item)}
                    />
                  </li>
                ))}
              </ul>
            )
          ) : (
            <div className="collection-empty">
              <EmptyArt kind={emptyArtKind(collection)} />
              <strong>
                {offset
                  ? "이 페이지에는 기록이 없어요"
                  : collection === "sessions"
                    ? "아직 넣어둔 이야기가 없어요"
                    : collection === "trash"
                      ? "휴지통이 비어 있어요"
                      : "이어갈 대화가 없어요"}
              </strong>
              <p>
                {collection === "trash"
                  ? "휴지통으로 옮긴 이야기가 여기에 모여요."
                  : "보관하기로 고른 내용이 여기에 모여요."}
              </p>
            </div>
          ))}
      </div>
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
