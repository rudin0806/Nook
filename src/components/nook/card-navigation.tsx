"use client";
import { useRef, useState, type CSSProperties, type ReactNode } from "react";

/** 가로로 이만큼 끌어야 넘어간다. */
const THRESHOLD = 60;
/** 끄는 동안 카드가 기우는 정도 — 60px에 약 4도. */
const TURN_PER_PX = 1 / 15;
/** 카드가 손을 따라가더라도 자기 칸을 통째로 벗어나지는 않는다. */
const MAX_DRAG = 96;

/** 화살표 키·손가락으로 쓸기·마우스로 끌기가 모두 같은 동작을 부른다.
 *
 * 전에는 터치만, 그것도 손을 뗀 뒤에만 받았다. 데스크톱에서 카드를 끌면 아무 일도
 * 일어나지 않았고 — 마우스에는 `touchstart`가 오지 않는다 — 터치에서도 끄는 동안
 * 화면이 가만히 있어서 넘어가는 중인지 알 수 없었다. 포인터 이벤트로 받으면
 * 마우스·펜·터치가 한 경로로 들어오고, 끄는 만큼 카드가 따라오게 할 수 있다.
 *
 * 끌린 거리는 `--drag-x`와 `--drag-turn`으로 내보낸다. 카드가 어떻게 따라올지는
 * 카드 쪽 CSS가 정한다 — 이 컴포넌트는 더미의 생김새를 모른다. */
export function CardNavigation({
  children,
  previous,
  next,
  label,
  turn,
}: {
  children: ReactNode;
  previous?: () => void;
  next?: () => void;
  label: string;
  /** Which way the last move went, so the card can travel that way. */
  turn?: "next" | "previous" | null;
}) {
  const start = useRef<{ x: number; y: number; pointer: number } | null>(null);
  const [drag, setDrag] = useState<number | null>(null);

  /** 끌기를 시작할 자리인지 본다. 링크와 버튼은 눌러서 쓰는 것이므로 가로채지
   *  않고, 이미 글자를 고르고 있다면 그 선택을 끌기로 읽지 않는다. */
  function grabbable(target: EventTarget | null) {
    return !(
      target instanceof Element &&
      target.closest("a,button,input,textarea,select")
    );
  }

  function begin(x: number, y: number, pointer: number) {
    start.current = { x, y, pointer };
    setDrag(0);
  }

  function release() {
    start.current = null;
    setDrag(null);
  }

  /** 끌기가 끝난 자리에서 방향을 판정한다. 가로로 THRESHOLD 넘게, 그리고 세로보다
   *  확실히 더 많이 움직였을 때만 넘긴다 — 세로로 훑다가 손이 비뚤어진 것을
   *  넘김으로 읽으면 읽던 카드가 사라진다. */
  function settle(x: number, y: number) {
    const origin = start.current;
    release();
    if (!origin || window.getSelection()?.toString()) return;
    const dx = x - origin.x;
    const dy = y - origin.y;
    if (Math.abs(dx) > THRESHOLD && Math.abs(dx) > Math.abs(dy) * 1.5)
      (dx > 0 ? previous : next)?.();
  }

  /** 갈 곳이 없는 쪽으로는 따라오지 않는다. 끝까지 왔다는 사실을 손에 알린다. */
  function resist(dx: number) {
    if ((dx < 0 && !next) || (dx > 0 && !previous)) return dx / 5;
    return dx;
  }

  /** 넓은 데스크톱에서 포인터를 화면 끝까지 끌면 카드도 수백 px 따라가면서
   *  홈의 도시락 칸을 뚫고 나갔다. 넘김에 필요한 거리는 60px뿐이므로 시각적
   *  이동은 카드 폭의 1/3과 96px 중 작은 값까지만 허용한다. */
  function boundedDrag(dx: number, width: number) {
    const limit = Math.max(THRESHOLD + 8, Math.min(MAX_DRAG, width / 3));
    const resisted = resist(dx);
    return Math.max(-limit, Math.min(limit, resisted));
  }

  return (
    <div
      className="card-navigation"
      data-turn={turn ?? undefined}
      data-dragging={drag !== null || undefined}
      style={
        {
          "--drag-x": `${drag ?? 0}px`,
          "--drag-turn": `${(drag ?? 0) * TURN_PER_PX}`,
        } as CSSProperties
      }
      onPointerDown={(event) => {
        if (
          event.pointerType === "touch" ||
          !event.isPrimary ||
          !grabbable(event.target)
        )
          return;
        // 카드 밖으로 손이 나가도 끌기가 이어져야 한다. 놓은 자리가 카드 밖이면
        // 끌기가 사라지던 것이 "안 넘어간다"로 보였다.
        event.currentTarget.setPointerCapture(event.pointerId);
        begin(event.clientX, event.clientY, event.pointerId);
      }}
      onPointerMove={(event) => {
        if (start.current?.pointer !== event.pointerId) return;
        const dx = event.clientX - start.current.x;
        const dy = event.clientY - start.current.y;
        if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
          event.preventDefault();
          window.getSelection()?.removeAllRanges();
        }
        setDrag(boundedDrag(dx, event.currentTarget.clientWidth));
      }}
      onPointerUp={(event) => {
        if (start.current?.pointer !== event.pointerId) return;
        settle(event.clientX, event.clientY);
      }}
      onPointerCancel={release}
      role="region"
      aria-label={label}
      tabIndex={0}
      onKeyDown={(event) => {
        if (
          event.target instanceof HTMLElement &&
          event.target.closest("input,textarea,select")
        )
          return;
        const action =
          event.key === "ArrowLeft"
            ? previous
            : event.key === "ArrowRight"
              ? next
              : undefined;
        if (action) {
          event.preventDefault();
          action();
        }
      }}
      onTouchStart={(event) => {
        const touch = event.touches[0];
        if (event.touches.length !== 1 || !grabbable(event.target)) {
          release();
          return;
        }
        begin(touch.clientX, touch.clientY, -1);
      }}
      onTouchMove={(event) => {
        const touch = event.touches[0];
        if (!start.current || !touch) return;
        setDrag(
          boundedDrag(
            touch.clientX - start.current.x,
            event.currentTarget.clientWidth,
          ),
        );
      }}
      onTouchCancel={release}
      onTouchEnd={(event) => {
        const touch = event.changedTouches[0];
        if (!touch) {
          release();
          return;
        }
        settle(touch.clientX, touch.clientY);
      }}
    >
      {children}
    </div>
  );
}
