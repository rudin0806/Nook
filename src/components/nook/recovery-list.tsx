"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { recoveryPageSchema, type RecoveryItem } from "@/schemas/recovery";
import { CardStack } from "./card-stack";
import { NookIcon } from "./nook-icon";
import { formatSeoulDeadline } from "@/lib/format/datetime";
import {
  previewRecovery,
  PREVIEW_EXPIRES_AT,
  PREVIEW_DEADLINE_LABEL,
} from "@/lib/example/preview";
export function RecoveryList({ preview = false }: { preview?: boolean }) {
  // 몇 번째 카드인지는 CardStack이 쥔다. 넘김과 애니메이션이 한 곳에 있어야
  // 방향과 자리가 어긋나지 않는다.
  const [loaded, setLoaded] = useState<RecoveryItem[]>([]),
    [total, setTotal] = useState(0),
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
        setTotal(page.total);
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
  // 미리보기는 만료를 세지 않는다. 고정된 표본 시각이 지나가면 화면이 통째로
  // 비어 버렸고, 그것은 미리보기가 말하려던 것과 정반대다.
  const visible = preview
    ? items
    : items.filter((i) => Date.parse(i.expiresAt) > now);
  const visibleTotal = preview ? visible.length : total;
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
        {visibleTotal > 0 && (
          <div className="panel-heading-actions">
            <span>{`${visibleTotal}개`}</span>
            {/* 더 있는 것은 여기로 간다. 패널 안에서 끝까지 넘기게 두면 스무 장을
                손으로 넘겨야 한다. */}
            <Link
              className="quiet-link"
              href={
                preview
                  ? "/drawer?preview=1&collection=recovery"
                  : "/drawer?collection=recovery"
              }
            >
              {/* 꺾쇠는 `.quiet-link::after`가 붙인다. 여기 또 적으면 둘이 된다. */}
              전체 보기
            </Link>
          </div>
        )}
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
      {/* 카드 더미. 뒤의 장이 비죽 보이고, 쓸어 넘기면 그 장이 올라온다.
          `a618bb6`이 지운 CardStack을 되살려 쓴다 — CSS는 그대로 남아 있었다. */}
      <CardStack
        label="이어갈 대화 카드"
        cards={visible.map((item, index) => ({
          id: item.id,
          content: (
            <>
              <span className="card-mark">
                {String(index + 1).padStart(2, "0")}
              </span>
              <p className="retention-card-title">{item.question}</p>
              <small>
                {preview
                  ? PREVIEW_DEADLINE_LABEL
                  : `${formatSeoulDeadline(item.expiresAt)}까지 이어갈 수 있어요.`}
              </small>
              <Link
                className="card-stack-open"
                href={
                  preview
                    ? `/talk/${item.nodeId}?preview=1`
                    : `/resume/${item.id}`
                }
              >
                {item.nodeId ? "이 대화 이어가기 ›" : "여기서 이어 적기 ›"}
              </Link>
            </>
          ),
        }))}
      />
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
