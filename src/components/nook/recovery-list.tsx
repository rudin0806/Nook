"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ActionButton } from "@seed-design/react";
import { recoveryPageSchema, type RecoveryItem } from "@/schemas/recovery";
import { CardNavigation } from "./card-navigation";
import { NookIcon } from "./nook-icon";
import { formatSeoulDeadline } from "@/lib/format/datetime";
import { previewRecovery, PREVIEW_EXPIRES_AT } from "@/lib/example/preview";
export function RecoveryList({ preview = false }: { preview?: boolean }) {
  const [selected, setSelected] = useState(0);
  // 어느 쪽으로 넘겼는지 기억해야 카드가 그 방향으로 지나간다. CardNavigation이
  // `data-turn`으로 읽는다.
  const [turn, setTurn] = useState<"next" | "previous" | null>(null);
  const [loaded, setLoaded] = useState<RecoveryItem[]>([]),
    [more, setMore] = useState(false),
    [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true),
    [now, setNow] = useState(() => Date.now());
  // 표본을 상태에 복사하면 안 된다. 토글은 클라이언트 내비게이션이라 이 컴포넌트가
  // 다시 마운트되지 않고, 초기값은 첫 마운트에서만 쓰인다. 매번 props에서 고른다.
  const items: RecoveryItem[] = preview
    ? previewRecovery.map((r) => ({
        id: r.id,
        status: "ACTIVE" as const,
        expiresAt: PREVIEW_EXPIRES_AT,
        nodeId: r.nodeId,
        question: r.question,
      }))
    : loaded;
  // 미리보기에는 불러올 것이 없으므로 기다리는 상태도 없다.
  const busy = preview ? false : loading;
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
        setLoaded((v) =>
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
        if (alive.current) setLoading(false);
      });
  }
  useEffect(() => {
    alive.current = true;
    if (preview) return;
    void load(0);
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => {
      alive.current = false;
      clearInterval(timer);
    };
  }, [preview]);
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
      {/* 홈에서 바로 넘긴다. 카드를 눌러야 열리는 모달을 따로 두면 같은 것을
          보는 길이 둘이 되고, 쌓인 카드를 훑는 데 한 번 더 눌러야 했다.
          좌우로 쓸거나 화살표를 누르면 넘어가고, 방향대로 카드가 지나간다. */}
      {current ? (
        <CardNavigation
          label="이어갈 대화 카드"
          turn={turn}
          previous={
            activeIndex > 0
              ? () => {
                  setTurn("previous");
                  setSelected(activeIndex - 1);
                }
              : undefined
          }
          next={
            activeIndex < visible.length - 1
              ? () => {
                  setTurn("next");
                  setSelected(activeIndex + 1);
                }
              : undefined
          }
        >
          <div className="card-stack">
            <article className="browse-card" key={current.id}>
              <span className="card-mark">
                {String(activeIndex + 1).padStart(2, "0")}
              </span>
              <h3>{current.question}</h3>
              <p>
                {formatSeoulDeadline(current.expiresAt)}까지 이어갈 수 있어요.
              </p>
              <Link
                href={
                  preview
                    ? `/talk/${current.nodeId}?preview=1`
                    : `/resume/${current.id}`
                }
              >
                {current.nodeId ? "이 대화 이어가기 ›" : "여기서 이어 적기 ›"}
              </Link>
            </article>
          </div>
          {visible.length > 1 ? (
            <div className="card-controls">
              <button
                type="button"
                aria-label="이전 카드"
                disabled={activeIndex <= 0}
                onClick={() => {
                  setTurn("previous");
                  setSelected(Math.max(0, activeIndex - 1));
                }}
              >
                ←
              </button>
              <span aria-live="polite">
                {activeIndex + 1} / {visible.length}
              </span>
              <button
                type="button"
                aria-label="다음 카드"
                disabled={activeIndex >= visible.length - 1}
                onClick={() => {
                  setTurn("next");
                  setSelected(Math.min(visible.length - 1, activeIndex + 1));
                }}
              >
                →
              </button>
            </div>
          ) : null}
          {/* 모달에 있던 안내다. 모달을 걷어내면서 사라질 뻔했는데, 지금은
              사용자가 직접 치울 수도 있어 더 필요해졌다. */}
          <p className="card-policy">
            만료되면 계정에 연결된 대화는 휴지통으로 이동하고, 익명 대화는
            삭제돼요.
          </p>
        </CardNavigation>
      ) : null}
      {more ? (
        <ActionButton
          variant="ghost"
          disabled={busy}
          onClick={() => {
            setLoading(true);
            void load(items.length);
          }}
        >
          이전 대화 더 불러오기
        </ActionButton>
      ) : null}
      {notice ? (
        <div role="status">
          <p>{notice}</p>
          <button
            onClick={() => {
              setLoading(true);
              void load(0);
            }}
          >
            다시 불러오기
          </button>
        </div>
      ) : null}
    </section>
  );
}
