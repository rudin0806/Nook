"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export type ShelfItem = {
  id: string;
  text: string;
  spine: string;
  date: string;
  size?: number;
};
export type ShelfView = "shelf" | "grid";

const VIEW_KEY = "nook-shelf-view-v1";
const OPEN_MS = 320;
const WIDE_COLUMNS = 10;
const NARROW_COLUMNS = 5;
const WIDE_QUERY = "(min-width: 761px)";

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

/** Rows are built here rather than by wrapping, because a book that grows has to
 * push its neighbours along the row, and a wrapping list would reflow into the
 * next row instead.
 */
function subscribeWidth(notify: () => void) {
  const query = window.matchMedia(WIDE_QUERY);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
}
function readColumns(): number {
  try {
    return window.matchMedia(WIDE_QUERY).matches
      ? WIDE_COLUMNS
      : NARROW_COLUMNS;
  } catch {
    return WIDE_COLUMNS;
  }
}

function prefersReducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** A spine is tall but narrow, so the label is clipped by height. Vertical text
 * gets no ellipsis from the browser, so the cut is made here instead of letting
 * a glyph be sliced in half.
 */
/** 책등에 들어가는 글자 수. 책 높이에서 번호와 여백을 뺀 자리를 13px 세로쓰기로
 *  재서 얻은 값이다(160/176/190/204/218px → 139px일 때 12글자). 문장부호가 많은
 *  제목이 넘치지 않도록 실측보다 한 글자씩 덜 쓴다. */
export const SPINE_MAX_BY_SIZE: Record<number, number> = {
  1: 8,
  2: 9,
  3: 11,
  4: 12,
  5: 14,
};

export function clampSpineLabel(value: string, max = 9): string {
  const text = value.trim();
  if ([...text].length <= max) return text;
  // 자른 끝이 공백이면 그 자리에서 줄이 바뀌어 `…`가 다음 열로 넘어간다. 세로쓰기의
  // 다음 열은 왼쪽에 생기므로 말줄임이 글 위쪽에 따로 떠 있는 것처럼 보인다.
  return `${[...text]
    .slice(0, max - 1)
    .join("")
    .trimEnd()}…`;
}

/** Upright vertical text gives every character its own slot, which leaves a
 * date reading as "2 6 . 1 . 1" down the spine. Short runs of digits are set
 * sideways-in-vertical instead, the way a date is set on a real book spine, so
 * "26.10.10" occupies three slots rather than eight.
 */
export function spineTokens(label: string): { text: string; tcy: boolean }[] {
  // 종서 숫자 처리는 날짜에만 쓴다. 제목에 점이 섞여 있을 때 나눠 버리면 그 점이
  // 사라지므로, 숫자와 점으로만 된 글자가 아니면 통째로 한 덩어리로 둔다.
  if (!/^[\d.]+$/.test(label)) return [{ text: label, tcy: false }];
  return label
    .split(".")
    .filter((part) => part.length > 0)
    .map((part) => ({ text: part, tcy: /^\d{1,2}$/.test(part) }));
}

/** Size means something: it comes from how much the conversation holds. The tilt
 * and the space beside a book stay positional, so a shelf of similar-sized
 * books still reads as a shelf rather than a chart.
 */
function jitterOf(index: number): number {
  return ((index * 7 + Math.floor(index / 5) * 3) % 10) + 1;
}

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
  const columns = useSyncExternalStore(
    subscribeWidth,
    readColumns,
    () => WIDE_COLUMNS,
  );
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

  const rows: ShelfItem[][] = [];
  for (let start = 0; start < items.length; start += columns)
    rows.push(items.slice(start, start + columns));

  return (
    <div className="saved-shelf" data-view={view} data-opening={!!opening}>
      <div className="shelf-view-switch" role="group" aria-label="보기 방식">
        <button
          type="button"
          data-active={view === "shelf"}
          aria-pressed={view === "shelf"}
          onClick={() => writeView("shelf")}
        >
          <span aria-hidden="true">▯▯▯</span> 책장
        </button>
        <button
          type="button"
          data-active={view === "grid"}
          aria-pressed={view === "grid"}
          onClick={() => writeView("grid")}
        >
          <span aria-hidden="true">▤</span> 표지
        </button>
      </div>

      {view === "shelf" ? (
        <div className="bookshelf" aria-label="보관한 이야기 책장">
          {rows.map((row, rowIndex) => (
            <div className="shelf-row" key={rowIndex}>
              <ul className="shelf-books">
                {row.map((item, column) => {
                  const index = rowIndex * columns + column;
                  return (
                    <li className="book-cell" key={item.id}>
                      <Link
                        href={`/drawer/${item.id}`}
                        className="book"
                        data-tone={(index % 8) + 1}
                        data-size={item.size ?? 3}
                        data-jitter={jitterOf(index)}
                        data-opening={opening === item.id || undefined}
                        aria-label={`${item.text} 펼쳐보기`}
                        onClick={(event) => open(event, item.id)}
                      >
                        <span className="book-spine">
                          <span className="book-spine-title">
                            {spineTokens(
                              clampSpineLabel(
                                item.spine,
                                SPINE_MAX_BY_SIZE[item.size ?? 3] ?? 11,
                              ),
                            ).map((token, position) => (
                              <span
                                className="spine-token"
                                data-tcy={token.tcy || undefined}
                                key={position}
                              >
                                {token.text}
                              </span>
                            ))}
                          </span>
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
                  );
                })}
              </ul>
            </div>
          ))}
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
