"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ActionButton } from "@seed-design/react";
import { recoveryPageSchema, type RecoveryItem } from "@/schemas/recovery";
import { CardNavigation } from "./card-navigation";
import { NookIcon } from "./nook-icon";
import { formatSeoulDeadline } from "@/lib/format/datetime";
export function RecoveryList() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState(0);
  const [items, setItems] = useState<RecoveryItem[]>([]),
    [more, setMore] = useState(false),
    [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(true),
    [now, setNow] = useState(() => Date.now());
  const lock = useRef(false),
    alive = useRef(true);
  function load(offset: number) {
    if (lock.current) return;
    lock.current = true;
    void fetch(`/api/recovery?limit=3&offset=${offset}`, {
      cache: "no-store",
      credentials: "same-origin",
    })
      .then(async (r) => {
        if (r.status === 401) return null;
        if (!r.ok) throw new Error();
        return recoveryPageSchema.parse((await r.json()).data);
      })
      .then((page) => {
        if (!alive.current || !page) return;
        setNotice("");
        setItems((v) =>
          offset === 0
            ? page.items
            : [
                ...v,
                ...page.items.filter((n) => !v.some((old) => old.id === n.id)),
              ],
        );
        setMore(page.hasMore);
      })
      .catch(() => {
        if (alive.current) setNotice("이전 대화를 불러오지 못했어요.");
      })
      .finally(() => {
        lock.current = false;
        if (alive.current) setBusy(false);
      });
  }
  useEffect(() => {
    alive.current = true;
    void load(0);
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => {
      alive.current = false;
      clearInterval(timer);
    };
  }, []);
  const visible = items.filter((i) => Date.parse(i.expiresAt) > now);
  const activeIndex = Math.min(selected, Math.max(0, visible.length - 1));
  const current = visible[activeIndex];
  return (
    <section aria-label="이어갈 대화" className="recovery-panel">
      <div className="panel-heading">
        <div className="panel-title-with-icon">
          <NookIcon name="conversation" tone="orange" tile />
          <div>
            <span className="panel-eyebrow">아직 펼쳐둔 생각</span>
            <h2>이어갈 대화</h2>
          </div>
        </div>
        <span>
          {visible.length > 0 ? `${visible.length}${more ? "+" : ""}개` : ""}
        </span>
      </div>
      {busy && !items.length ? (
        <p role="status">대화를 불러오고 있어요.</p>
      ) : null}
      {!busy && !visible.length && !notice ? (
        <div className="recovery-empty">
          <div className="empty-cards" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <div className="empty-card-copy">
            <strong>아직 이어갈 대화가 없어요</strong>
            <p>대화를 남기면 다시 묻고 싶은 질문이 카드로 쌓여요.</p>
          </div>
        </div>
      ) : null}
      <div className="scattered-cards">
        {visible.slice(0, 4).map((item, index) => (
          <button
            className="thought-card"
            key={item.id}
            onClick={() => {
              setSelected(index);
              dialog.current?.showModal();
            }}
          >
            <span className="card-mark">
              {String(index + 1).padStart(2, "0")}
            </span>
            <strong>{item.question}</strong>
            <span className="card-caption">
              {item.nodeId ? "펼쳐보기 ›" : "첫 질문 정하기 ›"}
            </span>
          </button>
        ))}
      </div>
      {more ? (
        <ActionButton
          variant="ghost"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void load(items.length);
          }}
        >
          이전 대화 더 불러오기
        </ActionButton>
      ) : null}
      {visible.length > 4 ? (
        <button
          className="recovery-browse"
          onClick={() => {
            setSelected(4);
            dialog.current?.showModal();
          }}
        >
          모든 대화 살펴보기 →
        </button>
      ) : null}
      {notice ? (
        <div role="status">
          <p>{notice}</p>
          <button
            onClick={() => {
              setBusy(true);
              void load(0);
            }}
          >
            다시 불러오기
          </button>
        </div>
      ) : null}
      <dialog
        ref={dialog}
        className="card-browser"
        aria-labelledby="card-browser-title"
      >
        <div className="panel-heading">
          <h2 id="card-browser-title">이어갈 대화</h2>
          <button
            autoFocus
            aria-label="닫기"
            onClick={() => dialog.current?.close()}
          >
            닫기 ×
          </button>
        </div>
        {current ? (
          <>
            <CardNavigation
              label="이어갈 대화 카드"
              previous={
                activeIndex > 0 ? () => setSelected(activeIndex - 1) : undefined
              }
              next={
                activeIndex < visible.length - 1
                  ? () => setSelected(activeIndex + 1)
                  : undefined
              }
            >
              <div className="card-stack">
                <article className="browse-card" key={current.id}>
                  <span className="panel-eyebrow">
                    {current.nodeId
                      ? "아직 남기지 않은 생각"
                      : "첫 질문을 정하기 전에 적은 생각"}
                  </span>
                  <h3>{current.question}</h3>
                  <p>{formatSeoulDeadline(current.expiresAt)}까지 이어갈 수 있어요.</p>
                  <Link href={`/resume/${current.id}`}>
                    {current.nodeId
                      ? "이 대화 이어가기 ›"
                      : "여기서 이어 적기 ›"}
                  </Link>
                </article>
              </div>
              <div className="card-controls">
                <button
                  aria-label="이전 카드"
                  disabled={activeIndex <= 0}
                  onClick={() => setSelected(Math.max(0, activeIndex - 1))}
                >
                  ←
                </button>
                <span aria-live="polite">
                  {Math.min(selected + 1, visible.length)} / {visible.length}
                </span>
                <button
                  aria-label="다음 카드"
                  disabled={activeIndex >= visible.length - 1}
                  onClick={() =>
                    setSelected(Math.min(visible.length - 1, activeIndex + 1))
                  }
                >
                  →
                </button>
              </div>
            </CardNavigation>
            <p className="card-policy">
              만료되면 계정에 연결된 대화는 휴지통으로 이동하고, 익명 대화는
              삭제돼요.
            </p>
          </>
        ) : (
          <p>이어갈 수 있는 대화가 없어요.</p>
        )}
      </dialog>
    </section>
  );
}
