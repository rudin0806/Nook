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
/** 책등 한 줄에 들어가는 칸 수(말줄임 한 칸 포함). 책 크기마다 글이 설 수 있는
 *  높이를 실제로 재서 얻었다 — 세로쓰기는 글자마다 한 칸(13px)을 똑같이 쓰므로
 *  높이를 칸 수로 나누면 그대로 나온다.
 *
 *    크기   책 높이   글 자리   재어 본 칸   쓰는 칸
 *      1     160px     130px       10          9
 *      2     176px     146px       11         10
 *      3     191px     161px       12         11
 *      4     206px     176px       13         12
 *      5     220px     190px       15         14
 *
 *  글꼴이 늦게 붙거나 대체 글꼴로 그려질 때를 생각해 실측보다 한 칸씩 덜 쓴다. */
export const SPINE_MAX_BY_SIZE: Record<number, number> = {
  1: 9,
  2: 10,
  3: 11,
  4: 12,
  5: 14,
};

/** 말줄임은 글자로 붙이지 않는다. 세로쓰기(`text-orientation: upright`)에서 `…`는
 * 제 자리를 얻지 못하고 앞 글자 위에 겹쳐 그려진다 — 잘린 책등마다 마지막 글자에
 * 점 세 개가 덧칠된 것처럼 보였다. 잘렸다는 사실만 넘기고, 표시는 한 칸짜리 상자로
 * 따로 그린다. `max`는 그 상자까지 포함한 칸 수다. */
export function clampSpine(
  value: string,
  max = 9,
): { text: string; cut: boolean } {
  const text = value.trim();
  if ([...text].length <= max) return { text, cut: false };
  // 자른 끝이 공백이면 그 자리에서 줄이 바뀌어 말줄임이 다음 열로 넘어간다.
  // 세로쓰기의 다음 열은 왼쪽에 생기므로 글 위쪽에 따로 떠 있는 것처럼 보인다.
  return {
    text: [...text]
      .slice(0, max - 1)
      .join("")
      .trimEnd(),
    cut: true,
  };
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

/** 책장으로 볼지 표지로 볼지 고르는 자리. 책장 위가 아니라 화면의 도구 줄에 선다 —
 * 무엇을 볼지 고르는 일과 순서를 정리하는 일은 같은 줄에 있는 편이 찾기 쉽다.
 * 고른 값은 SavedShelf와 같은 저장소를 읽으므로 둘이 어긋날 일이 없다. */
export function ShelfViewSwitch() {
  const view = useSyncExternalStore(subscribeView, readView, () => "shelf");
  return (
    <div className="shelf-view-switch" role="group" aria-label="보기 방식">
      <button
        type="button"
        data-active={view === "shelf"}
        aria-pressed={view === "shelf"}
        onClick={() => writeView("shelf")}
      >
        <svg viewBox="0 0 18 16" aria-hidden="true">
          <rect x="1.5" y="4" width="4" height="10" rx="1" />
          <rect x="7" y="2" width="4" height="12" rx="1" />
          <path d="m13 4 3-.5 1.5 10-3 .5L13 4Z" />
        </svg>
        책장
      </button>
      <button
        type="button"
        data-active={view === "grid"}
        aria-pressed={view === "grid"}
        onClick={() => writeView("grid")}
      >
        <svg viewBox="0 0 18 16" aria-hidden="true">
          <rect x="2" y="1.5" width="14" height="13" rx="1.5" />
          <path d="M5 5h8M5 8h8M5 11h5" />
        </svg>
        표지
      </button>
    </div>
  );
}

export function SavedShelf({
  items,
  offset,
  formatDate,
  preview = false,
}: {
  items: ShelfItem[];
  offset: number;
  formatDate: (value: string) => string;
  /** 미리보기에서는 책이 보이기만 하고 열리지 않는다. 표본 id로 이동하면 없는
   *  기록을 찾으러 가는 셈이고, 미리보기는 보는 것까지다. */
  preview?: boolean;
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
    // 미리보기에서도 다음 칸으로 넘어간다. 잠가 두었더니 책장이 그림처럼 보였고,
    // 쓰면 무엇이 남는지 보여 주는 일이 책등에서 끝나 버렸다. 열리는 곳은 표본
    // 이야기이므로 데이터베이스에는 닿지 않는다.
    if (preview) return;
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
    <div
      className="saved-shelf"
      data-view={view}
      data-opening={!!opening}
      data-preview={preview || undefined}
    >
      {view === "shelf" ? (
        <div className="bookshelf" aria-label="보관한 이야기 책장">
          {rows.map((row, rowIndex) => (
            <div className="shelf-row" key={rowIndex}>
              <ul className="shelf-books">
                {row.map((item, column) => {
                  const index = rowIndex * columns + column;
                  const label = clampSpine(
                    item.spine,
                    SPINE_MAX_BY_SIZE[item.size ?? 3] ?? 11,
                  );
                  return (
                    <li className="book-cell" key={item.id}>
                      <Link
                        href={`/drawer/${item.id}${preview ? "?preview=1" : ""}`}
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
                            {spineTokens(label.text).map((token, position) => (
                              <span
                                className="spine-token"
                                data-tcy={token.tcy || undefined}
                                key={position}
                              >
                                {token.text}
                              </span>
                            ))}
                            {label.cut && (
                              <span className="spine-cut" aria-hidden="true">
                                …
                              </span>
                            )}
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
                href={`/drawer/${item.id}${preview ? "?preview=1" : ""}`}
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
