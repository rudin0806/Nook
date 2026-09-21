"use client";

import { useState } from "react";
import { ActionButton } from "@seed-design/react";
import { SavedShelf } from "./saved-shelf";
import { EmptyArt } from "./empty-art";
import { RetentionCard } from "./retention-card";
import {
  previewBooks,
  previewRecovery,
  PREVIEW_DEADLINE_LABEL,
  PREVIEW_EXPIRES_AT,
  PREVIEW_SAVED_AT,
} from "@/lib/example/preview";

type PreviewCollection = "sessions" | "recovery" | "trash";

/** 미리보기로 들어온 생각 더미.
 *
 * 처음에는 빈 화면으로 두었다. 미리보기를 켠 사람의 더미는 실제로 비어 있고, 가짜
 * 기록을 채우면 처음 쓴 뒤에 화면이 줄어든 것처럼 보인다는 이유였다. 그 걱정은 지금
 * 보는 것이 자기 기록이 아니라는 말을 화면이 하지 않고 있었기 때문에 생긴 것인데,
 * 위쪽 띠가 그 말을 하게 된 뒤로는 빈 화면이 오히려 "여기는 아무것도 없는 곳"이라고
 * 말해 버린다. 쓰면 무엇이 남는지 보여 주는 것이 미리보기의 일이다.
 *
 * 표본 전용 화면을 새로 만들지 않는다. 실제 책장 컴포넌트에 홈과 같은 표본을 넣고,
 * 책은 열리지 않게만 잠근다 — 보는 것은 되고 하는 것은 안 된다.
 */
export function PreviewDrawer({
  initialCollection = "sessions",
}: {
  initialCollection?: PreviewCollection;
}) {
  const [collection, setCollection] =
    useState<PreviewCollection>(initialCollection);

  return (
    <section aria-label="생각 더미 미리보기" data-collection={collection}>
      <div className="preview-actions" role="group" aria-label="보관 종류">
        <ActionButton
          variant={collection === "sessions" ? "neutralSolid" : "neutralWeak"}
          aria-pressed={collection === "sessions"}
          onClick={() => setCollection("sessions")}
        >
          내 서랍
        </ActionButton>
        <ActionButton
          variant={collection === "recovery" ? "neutralSolid" : "neutralWeak"}
          aria-pressed={collection === "recovery"}
          onClick={() => setCollection("recovery")}
        >
          이어갈 대화
        </ActionButton>
        <ActionButton
          variant={collection === "trash" ? "neutralSolid" : "neutralWeak"}
          aria-pressed={collection === "trash"}
          onClick={() => setCollection("trash")}
        >
          휴지통
        </ActionButton>
      </div>

      {collection === "sessions" && (
        <SavedShelf
          preview
          offset={0}
          items={previewBooks.map((book) => ({
            id: book.id,
            text: book.title,
            spine: book.title,
            date: PREVIEW_SAVED_AT,
            size: book.size,
          }))}
          formatDate={(value) =>
            new Date(value).toLocaleDateString("ko-KR", {
              timeZone: "Asia/Seoul",
              month: "long",
              day: "numeric",
            })
          }
        />
      )}

      {collection === "recovery" && (
        <>
          <div className="shelf-edit-toolbar">
            <p>24시간 안에 이어갈 수 있어요.</p>
          </div>
          <ul className="drawer-list" aria-label="이어갈 대화 예시">
            {previewRecovery.map((item) => (
              <li key={item.id} className="preview-summary-card">
                <RetentionCard
                  item={{
                    id: item.id,
                    text: item.question,
                    date: PREVIEW_EXPIRES_AT,
                    nodeId: item.nodeId,
                  }}
                  collection="recovery"
                  busy={false}
                  dateLabel={PREVIEW_DEADLINE_LABEL}
                  openHref={`/talk/${item.nodeId}?preview=1`}
                  formatDate={() => ""}
                  onAct={() => undefined}
                />
              </li>
            ))}
          </ul>
        </>
      )}

      {collection === "trash" && (
        <div className="collection-empty">
          <EmptyArt kind="trash" />
          <strong>휴지통은 이렇게 비워져 있어요</strong>
          <p>지운 기록이 생기면 7일 동안 이곳에서 되돌릴 수 있어요.</p>
        </div>
      )}
    </section>
  );
}
