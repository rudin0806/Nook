import Link from "next/link";
import { ActionButton } from "@seed-design/react";

export type RetentionCollection = "sessions" | "questions" | "trash";

export type RetentionCardItem = {
  id: string;
  text: string;
  date: string;
  purgeAfter?: string;
};

/** The body of one kept record. Shared by the order-editing list and the card
 * stack so the two never drift apart in wording or in what they offer.
 */
export function RetentionCard({
  item,
  collection,
  busy,
  disabled = false,
  formatDate,
  onAct,
}: {
  item: RetentionCardItem;
  collection: RetentionCollection;
  busy: boolean;
  disabled?: boolean;
  formatDate: (value: string) => string;
  onAct: () => void;
}) {
  return (
    <>
      <p className="retention-card-title">{item.text}</p>
      <small>
        {formatDate(item.date)}에{" "}
        {collection === "trash" ? "휴지통으로 이동" : "보관"}
      </small>
      {item.purgeAfter && (
        <p className="retention-card-deadline">
          복원 기한:{" "}
          {new Date(item.purgeAfter).toLocaleString("ko-KR", {
            timeZone: "Asia/Seoul",
          })}{" "}
          (한국 시간)
        </p>
      )}
      <div className="retention-card-actions">
        {collection === "questions" && (
          <Link
            className="retention-card-open"
            href={`/restart/branch/${item.id}`}
          >
            이 질문으로 다시 생각하기 ↗
          </Link>
        )}
        {collection === "sessions" && (
          <Link className="retention-card-open" href={`/drawer/${item.id}`}>
            이야기 펼쳐보기 ↗
          </Link>
        )}
        <ActionButton
          variant="neutralWeak"
          disabled={busy || disabled}
          onClick={onAct}
        >
          {busy
            ? "처리 중…"
            : collection === "trash"
              ? "복원하기"
              : collection === "questions"
                ? "질문 삭제"
                : "휴지통으로 이동"}
        </ActionButton>
      </div>
    </>
  );
}
