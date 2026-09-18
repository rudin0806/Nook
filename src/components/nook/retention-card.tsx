import Link from "next/link";
import { ActionButton } from "@seed-design/react";
import { formatSeoulDeadline } from "@/lib/format/datetime";

export type RetentionCollection =
  "sessions" | "recovery" | "questions" | "trash";

export type RetentionCardItem = {
  id: string;
  text: string;
  date: string;
  purgeAfter?: string;
  /** Recovery only: null means the writing has no confirmed question yet. */
  nodeId?: string | null;
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
        {collection === "recovery"
          ? `${formatSeoulDeadline(item.date)}까지 이어갈 수 있어요`
          : `${formatDate(item.date)}에 ${collection === "trash" ? "휴지통으로 이동" : "보관"}`}
      </small>
      {item.purgeAfter && (
        <p className="retention-card-deadline">
          복원 기한: {formatSeoulDeadline(item.purgeAfter)} (한국 시간)
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
        {/* The same destination and the same two labels the home panel uses,
            so one list is not a different thing from the other. */}
        {collection === "recovery" && (
          <Link className="retention-card-open" href={`/resume/${item.id}`}>
            {item.nodeId ? "이 대화 이어가기 ›" : "여기서 이어 적기 ›"}
          </Link>
        )}
        {/* Nothing here is decided yet, so this list offers no way to throw one
            away — that choice belongs to the conversation's own exit. */}
        {collection !== "recovery" && (
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
        )}
      </div>
    </>
  );
}
