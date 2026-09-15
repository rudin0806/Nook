"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ActionButton } from "@seed-design/react";
import { recoveryPageSchema, type RecoveryItem } from "@/schemas/recovery";
export function RecoveryList() {
  const [items, setItems] = useState<RecoveryItem[]>([]),
    [more, setMore] = useState(false),
    [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false),
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
  if (!visible.length && !notice && !more) return null;
  return (
    <aside aria-label="이어가던 대화" className="recovery-list">
      <h2>이어가던 대화</h2>
      <p>
        아직 생각 더미에 남기지 않았어요. 계정이 연결된 대화는 아래 시각에
        휴지통으로 옮겨져요. 익명 대화는 삭제돼요.
      </p>
      <ul>
        {visible.map((i) => (
          <li key={i.id}>
            <Link href={`/resume/${i.id}`}>{i.question}</Link>
            <small>
              {" "}
              ·{" "}
              {new Date(i.expiresAt).toLocaleString("ko-KR", {
                timeZone: "Asia/Seoul",
              })}
              까지 (한국 시간)
            </small>
          </li>
        ))}
      </ul>
      {more && (
        <ActionButton
          variant="ghost"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void load(items.length);
          }}
        >
          더 보기
        </ActionButton>
      )}
      {notice && (
        <>
          <p role="status">{notice}</p>
          <ActionButton
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void load(0);
            }}
          >
            다시 불러오기
          </ActionButton>
        </>
      )}
    </aside>
  );
}
