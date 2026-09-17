"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export type ShelfItem = {
  id: string;
  text: string;
  date: string;
};
export type ShelfView = "shelf" | "grid";

const VIEW_KEY = "nook-shelf-view-v1";
const OPEN_MS = 320;

/** The chosen view lives in the browser, so it is read as an external store
 * rather than copied into state after mount: the server renders the shelf, and
 * a reader who picked covers sees them on the first client paint instead of a
 * flash of the other layout.
 */
const listeners = new Set<() => void>();
function subscribeView(notify: () => void) {
  listeners.add(notify);
  window.addEventListener("storage", notify);
  return () => {
    listeners.delete(notify);
    window.removeEventListener("storage", notify);
  };
}
function readView(): ShelfView {
  try {
    return localStorage.getItem(VIEW_KEY) === "grid" ? "grid" : "shelf";
  } catch {
    return "shelf";
  }
}
function writeView(next: ShelfView) {
  try {
    localStorage.setItem(VIEW_KEY, next);
  } catch {}
  for (const notify of listeners) notify();
}

function prefersReducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** Saved stories, as a shelf of spines or as a wall of covers.
 *
 * Shelf: a book is a spine until it is pointed at or focused, and then that one
 * book turns face-on in place, overlapping its neighbours rather than pushing
 * them. Choosing it plays a short opening move and then navigates, so the jump
 * into a story reads as continuous. Reduced motion skips straight to the page.
 */
export function SavedShelf({
  items,
  offset,
  formatDate,
}: {
  items: ShelfItem[];
  offset: number;
  formatDate: (value: string) => string;
}) {
  const router = useRouter();
  const view = useSyncExternalStore(subscribeView, readView, () => "shelf");
  const [opening, setOpening] = useState<string | null>(null);
  // The opening move ends in a navigation; if the list goes away first, the
  // pending jump has to go with it.
  const timer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  function choose(next: ShelfView) {
    writeView(next);
  }

  function open(event: React.MouseEvent, id: string) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0)
      return;
    if (prefersReducedMotion()) return;
    event.preventDefault();
    setOpening(id);
    timer.current = window.setTimeout(
      () => router.push(`/drawer/${id}`),
      OPEN_MS,
    );
  }

  return (
    <div className="saved-shelf" data-view={view} data-opening={!!opening}>
      <div className="shelf-view-switch" role="group" aria-label="보기 방식">
        <button
          type="button"
          data-active={view === "shelf"}
          aria-pressed={view === "shelf"}
          onClick={() => choose("shelf")}
        >
          <span aria-hidden="true">▯▯▯</span> 책장
        </button>
        <button
          type="button"
          data-active={view === "grid"}
          aria-pressed={view === "grid"}
          onClick={() => choose("grid")}
        >
          <span aria-hidden="true">▤</span> 표지
        </button>
      </div>

      {view === "shelf" ? (
        <div className="bookshelf" aria-label="보관한 이야기 책장">
          <ul className="bookshelf-grid">
            {items.map((item, index) => (
              <li className="book-cell" key={item.id}>
                <Link
                  href={`/drawer/${item.id}`}
                  className="book"
                  data-tone={(index % 8) + 1}
                  data-opening={opening === item.id || undefined}
                  aria-label={`${item.text} 펼쳐보기`}
                  onClick={(event) => open(event, item.id)}
                >
                  <span className="book-spine">
                    <span className="book-spine-title">{item.text}</span>
                    <span className="book-spine-number">
                      {String(offset + index + 1).padStart(2, "0")}
                    </span>
                  </span>
                  <span className="book-face" aria-hidden="true">
                    <span className="book-face-index">
                      {String(offset + index + 1).padStart(2, "0")}
                    </span>
                    <strong>{item.text}</strong>
                    <small>{formatDate(item.date)}</small>
                    <span className="book-face-open">펼쳐보기 ↗</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="bookshelf-hint">
            책을 가리키거나 키보드로 선택하면 한 권씩 앞으로 나와요.
          </p>
        </div>
      ) : (
        <ul className="cover-grid" aria-label="보관한 이야기 표지">
          {items.map((item, index) => (
            <li key={item.id}>
              <Link
                href={`/drawer/${item.id}`}
                className="cover-card"
                data-tone={(index % 8) + 1}
                data-opening={opening === item.id || undefined}
                onClick={(event) => open(event, item.id)}
              >
                <span className="cover-index">
                  {String(offset + index + 1).padStart(2, "0")}
                </span>
                <strong>{item.text}</strong>
                <small>{formatDate(item.date)}</small>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
