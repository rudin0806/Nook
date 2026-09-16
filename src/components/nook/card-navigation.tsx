"use client";
import { useRef, type ReactNode } from "react";

/** Arrow keys and horizontal touch gestures share the visible button actions. */
export function CardNavigation({
  children,
  previous,
  next,
  label,
}: {
  children: ReactNode;
  previous?: () => void;
  next?: () => void;
  label: string;
}) {
  const start = useRef<{ x: number; y: number } | null>(null);
  return (
    <div
      className="card-navigation"
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
        start.current =
          event.touches.length === 1
            ? { x: touch.clientX, y: touch.clientY }
            : null;
      }}
      onTouchCancel={() => {
        start.current = null;
      }}
      onTouchEnd={(event) => {
        const origin = start.current;
        start.current = null;
        const touch = event.changedTouches[0];
        if (!origin || !touch || window.getSelection()?.toString()) return;
        const dx = touch.clientX - origin.x,
          dy = touch.clientY - origin.y;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5)
          (dx > 0 ? previous : next)?.();
      }}
    >
      {children}
    </div>
  );
}
