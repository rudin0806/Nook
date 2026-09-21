import Link from "next/link";
import { ActionButton } from "@seed-design/react";
import { formatDaysLeft, formatSeoulDeadline } from "@/lib/format/datetime";

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
  picking = false,
  formatDate,
  onAct,
}: {
  item: RetentionCardItem;
  collection: RetentionCollection;
  busy: boolean;
  /** 고르는 중에는 카드를 열지 않는다. 치우려고 누른 것이 대화를 여는 것으로
   *  끝나면 고르던 것을 잃는다. */
  picking?: boolean;
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
        <p
          className="retention-card-deadline"
          title={`복원 기한 ${formatSeoulDeadline(item.purgeAfter)} (한국 시간)`}
        >
          {formatDaysLeft(item.purgeAfter)}
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
        {collection === "recovery" && !picking && (
          <Link className="retention-card-open" href={`/resume/${item.id}`}>
            {item.nodeId ? "이 대화 이어가기 ›" : "여기서 이어 적기 ›"}
          </Link>
        )}
        {/* 이어갈 대화는 카드마다 버튼을 두지 않는다. 고르는 모드에서 여러 개를
            한 번에 치우고, 아직 아무것도 정해지지 않은 목록에 버리는 버튼이 늘
            떠 있지 않게 한다. */}
        {collection !== "recovery" && (
          <ActionButton variant="neutralWeak" disabled={busy} onClick={onAct}>
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
