"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { CardNavigation } from "./card-navigation";

export type StackCard = {
  id: string;
  content: ReactNode;
};

/** globals.css의 `.card-stack[data-leaving]` 전환과 같은 길이여야 한다. */
const SLIDE_MS = 260;

function prefersReducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** 한 번에 한 장, 뒤의 몇 장이 비죽 보이는 더미.
 *
 * 넘기면 맨 위 장이 그쪽으로 빠지고 뒤의 장이 그 자리로 올라온다. 이 컴포넌트는
 * `a618bb6`에서 참조가 사라졌다는 이유로 지워졌는데, 그 뒤로 CSS만 남아 아무도 쓰지
 * 않는 채로 있었다. 되살려서 홈의 이어갈 대화가 쓴다.
 *
 * 화살표 버튼과 몇 번째인지 세는 글자는 두지 않는다 — 더미가 쌓여 있는 모양 자체가
 * 더 있다는 말을 하고, 세는 일은 패널 머리의 `n개`가 한다. 대신 **뒤의 장을 눌러도
 * 넘어간다**. 마우스만 쓰는 사람에게 남는 유일한 손잡이라 이것까지 없으면 넘길
 * 방법이 사라진다. 좌우 화살표 키와 쓸어 넘기기는 CardNavigation이 맡는다.
 */
export function CardStack({
  cards,
  label,
  emptyLabel,
}: {
  cards: StackCard[];
  label: string;
  emptyLabel?: string;
}) {
  const [index, setIndex] = useState(0);
  const [leaving, setLeaving] = useState<"next" | "previous" | null>(null);
  const timer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );
  // 목록이 줄거나 페이지가 바뀌면 커서가 끝을 넘어가 있을 수 있다.
  const active = Math.min(index, Math.max(0, cards.length - 1));

  function move(direction: "next" | "previous") {
    const target = direction === "next" ? active + 1 : active - 1;
    if (target < 0 || target >= cards.length) return;
    if (prefersReducedMotion()) {
      setIndex(target);
      return;
    }
    setLeaving(direction);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setIndex(target);
      setLeaving(null);
    }, SLIDE_MS);
  }

  if (!cards.length)
    return emptyLabel ? <p className="card-stack-empty">{emptyLabel}</p> : null;

  // 맨 위 장과 뒤의 두 장만 그린다. 더 깊어도 보이는 것은 같고 스무 장이 트리에 든다.
  const shown = cards.slice(active, active + 3);
  const more = active < cards.length - 1;
  return (
    <div className="card-stack" data-leaving={leaving ?? undefined}>
      <CardNavigation
        label={label}
        previous={active > 0 ? () => move("previous") : undefined}
        next={more ? () => move("next") : undefined}
      >
        <ul className="card-stack-cards">
          {shown.map((card, depth) => (
            <li
              key={card.id}
              className="card-stack-card"
              data-depth={depth}
              aria-hidden={depth > 0 || undefined}
              inert={depth > 0}
            >
              {card.content}
            </li>
          ))}
        </ul>
        {more && (
          // 뒤의 장 위에 겹쳐 두는 손잡이다. 카드 자체를 버튼으로 만들면 그 안의
          // 링크와 중첩되므로, 비죽 나온 자리만 덮는다.
          <button
            type="button"
            className="card-stack-next"
            onClick={() => move("next")}
          >
            다음 대화 보기
          </button>
        )}
      </CardNavigation>
      <p className="card-stack-position" aria-live="polite">
        {active + 1} / {cards.length}
      </p>
    </div>
  );
}
