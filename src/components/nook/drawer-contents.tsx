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
import { SavedShelf, ShelfViewSwitch } from "./saved-shelf";
import { Toast, type ToastNotice } from "./toast";
import { EmptyArt } from "./empty-art";
import { recoveryPageSchema } from "@/schemas/recovery";
import { RetentionCard } from "./retention-card";
import { formatRecordDate } from "@/lib/format/datetime";
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
  // 이어갈 대화를 골라 치우는 모드. 고른 것이 무엇인지 화면에 남아야 해서
  // 목록과 따로 센다.
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const [notice, setNotice] = useState<ToastNotice | null>(null);
  // 같은 문장이 다시 떠도 머무는 시간이 처음부터 흐르도록 회차를 센다.
  const noticeCount = useRef(0);
  function say(text: string, needsLogin?: boolean) {
    setNotice({
      id: (noticeCount.current += 1),
      text,
      action: needsLogin
        ? { href: "/login", label: "계정 다시 연결하기" }
        : undefined,
    });
  }
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
                // 휴지통은 무엇을 복원하는지 알아야 하므로 질문을 먼저 쓴다.
                // 확정된 질문이 없는 기록만 날짜로 부른다.
                text:
                  ("question" in item ? item.question : null) ??
                  `${formatRecordDate(item.started_at)}의 이야기`,
                // 책등은 질문을 쓴다. 날짜를 압축한 `2699`는 네 글자를 쓰고도 어느
                // 책인지 말해 주지 않는다. 자리가 좁으니 책 크기에 맞춰 자른다.
                spine:
                  ("question" in item ? item.question : null) ??
                  spineLabel(item.started_at),
                ...("turn_count" in item
                  ? { size: sizeLevel(item.turn_count, item.node_count) }
                  : {}),
                // 휴지통은 언제 지웠는지가 중요하므로 버린 날을 쓴다. 서랍의
                // 책은 그 이야기의 날짜를 쓴다 — `retention_decided_at`은 보관을
                // 결정한 때라, 휴지통에서 되돌리면 오늘로 갱신되어 오래된 이야기가
                // 방금 쓴 것처럼 보였다.
                date:
                  "trashed_at" in item ? item.trashed_at : item.completed_at,
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
    endPicking();
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
      say(
        action === "restore"
          ? "내 서랍으로 복원했어요."
          : "휴지통으로 옮겼어요.",
      );
      // 정렬하던 책을 치우면 현재 순서 목록 자체가 바뀐다. 성공한 뒤 편집 모드를
      // 닫아, 마지막 책을 치운 화면에 종료 버튼도 없이 편집 상태만 남지 않게 한다.
      if (action === "trash") {
        setEditingOrder(false);
        setDraggedId(null);
      }
      setState({ kind: "loading" });
      setOffset(0);
      setAttempt((n) => n + 1);
    } catch (error) {
      if (error instanceof RetentionActionError)
        say(error.message, error.needsLogin);
      else
        say(
          "처리 결과를 확인하지 못했어요. 다시 누르기 전에 목록을 새로고침해 주세요.",
        );
    } finally {
      mutationLock.current = false;
      setBusy(false);
    }
  }

  function endPicking() {
    setPicking(false);
    setPicked(new Set());
  }

  function togglePicked(id: string) {
    setPicked((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  /** 고른 이어갈 대화를 휴지통으로 보낸다. 24시간 뒤 만료가 하던 일을 당기는
   *  것이라 7일 동안 휴지통에서 되돌릴 수 있다.
   *
   *  하나씩 보내고 중간에 실패해도 멈추지 않는다. 다섯 개를 고른 사람에게 첫
   *  실패로 전부 되돌리면, 무엇이 치워졌고 무엇이 남았는지 알 수 없게 된다. */
  async function discardPicked() {
    if (mutationLock.current || !picked.size) return;
    const targets = [...picked];
    const question =
      targets.length === 1
        ? "이 대화를 휴지통으로 옮길까요? 7일 동안 되돌릴 수 있어요."
        : `${targets.length}개를 휴지통으로 옮길까요? 7일 동안 되돌릴 수 있어요.`;
    if (!window.confirm(question)) return;
    mutationLock.current = true;
    setBusy(true);
    setNotice(null);
    let done = 0;
    let failure: RetentionActionError | null = null;
    try {
      for (const id of targets) {
        try {
          await performRetentionAction("discard", id);
          done += 1;
        } catch (error) {
          if (error instanceof RetentionActionError && !failure)
            failure = error;
          else if (!failure) failure = new RetentionActionError(false, "");
        }
      }
      if (!done)
        say(
          failure?.message ??
            "치우지 못했어요. 목록을 새로고침한 뒤 다시 시도해 주세요.",
          failure?.needsLogin,
        );
      else if (done < targets.length)
        say(
          `${done}개를 휴지통으로 옮겼어요. ${targets.length - done}개는 상태가 바뀌어 남아 있어요.`,
        );
      else say(`${done}개를 휴지통으로 옮겼어요.`);
      endPicking();
      setState({ kind: "loading" });
      setOffset(0);
      setAttempt((n) => n + 1);
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
      say(`${result.position}번째 자리에 저장했어요.`);
    } catch (error) {
      setState((current) =>
        current.kind === "ready" ? { ...current, items: previous } : current,
      );
      if (error instanceof RetentionActionError)
        say(error.message, error.needsLogin);
      else say("자리를 옮기지 못했어요. 다시 시도해 주세요.");
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
      <Toast notice={notice} onDismiss={() => setNotice(null)} />
      {collection === "trash" && (
        <p>휴지통으로 옮긴 이야기는 7일 동안 복원할 수 있어요.</p>
      )}
      {collection === "recovery" && (
        /* 설명과 편집 버튼이 한 줄에 선다. 버튼만 따로 아래 줄에 두었더니 새로고침
           에서 멀어져 어디에 걸린 동작인지 알기 어려웠다. */
        <div className="shelf-edit-toolbar" data-picking={picking || undefined}>
          <p>
            {picking
              ? "삭제할 대화를 선택해보세요. 7일 안에 복원할 수 있어요."
              : "24시간 안에 이어갈 수 있어요."}
          </p>
          {state.kind === "ready" &&
            !!state.items.length &&
            (picking ? (
              <div className="preview-actions">
                <ActionButton
                  variant="neutralSolid"
                  disabled={busy || !picked.size}
                  onClick={() => void discardPicked()}
                >
                  {busy
                    ? "옮기는 중…"
                    : picked.size
                      ? `${picked.size}개 휴지통으로`
                      : "고른 것 없음"}
                </ActionButton>
                <ActionButton
                  variant="neutralWeak"
                  disabled={busy}
                  onClick={endPicking}
                >
                  그만두기
                </ActionButton>
              </div>
            ) : (
              <div className="preview-actions">
                <ActionButton
                  variant="neutralWeak"
                  disabled={busy}
                  onClick={() => setPicking(true)}
                >
                  삭제하기
                </ActionButton>
              </div>
            ))}
        </div>
      )}
      {collection === "sessions" &&
        state.kind === "ready" &&
        !!state.items.length && (
          <div className="shelf-edit-toolbar shelf-library-toolbar">
            {editingOrder ? (
              <>
                <p>
                  끌거나 화살표를 눌러 순서를 바꿔보세요. 변경 내용은 바로
                  저장해요.
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
              <>
                <ShelfViewSwitch />
                {state.items.length > 1 && (
                  <div className="preview-actions">
                    <ActionButton
                      variant="neutralWeak"
                      disabled={busy}
                      onClick={beginOrderEdit}
                    >
                      책장 순서 편집
                    </ActionButton>
                  </div>
                )}
              </>
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
                formatDate={(value) => formatRecordDate(value)}
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
                    data-picking={picking || undefined}
                    data-picked={(picking && picked.has(item.id)) || undefined}
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
                    {picking && (
                      <label className="pick-control">
                        <input
                          type="checkbox"
                          checked={picked.has(item.id)}
                          disabled={busy}
                          onChange={() => togglePicked(item.id)}
                        />
                        <span>{item.text} 고르기</span>
                      </label>
                    )}
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
                      formatDate={(value) => formatRecordDate(value)}
                      picking={picking}
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
                  : "보관한 내용이 여기에 모여요."}
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
