"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { CardNavigation } from "./card-navigation";

export type StackCard = {
  id: string;
  content: ReactNode;
};

const SLIDE_MS = 260;

function prefersReducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** One card at a time, with the next few peeking out behind it.
 *
 * Moving on sends the top card away and lifts the one behind into its place,
 * which is the motion the shelf and the empty state also use, so the three read
 * as the same object. Arrow keys, a horizontal swipe and the two buttons all do
 * the same thing; reduced motion keeps the change and drops the travel.
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
  // A page change or a removal can leave the cursor past the end.
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

  // Only the top card and the two behind it are rendered; a deeper stack reads
  // no differently and would put twenty cards in the tree.
  const shown = cards.slice(active, active + 3);
  return (
    <div className="card-stack" data-leaving={leaving ?? undefined}>
      <CardNavigation
        label={label}
        previous={active > 0 ? () => move("previous") : undefined}
        next={active < cards.length - 1 ? () => move("next") : undefined}
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
      </CardNavigation>
      <div className="card-stack-controls">
        <button
          type="button"
          aria-label="이전 카드"
          disabled={active === 0}
          onClick={() => move("previous")}
        >
          ←
        </button>
        <p aria-live="polite">
          <strong>{active + 1}</strong> / {cards.length}
        </p>
        <button
          type="button"
          aria-label="다음 카드"
          disabled={active >= cards.length - 1}
          onClick={() => move("next")}
        >
          →
        </button>
      </div>
    </div>
  );
}
