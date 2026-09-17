"use client";
import { useState } from "react";
import Link from "next/link";
import { ActionButton } from "@seed-design/react";

/** Withdrawal is irreversible, so the confirmation is explicit rather than a
 * single tap: the panel stays closed until asked for, and the submit stays
 * disabled until the consequence is acknowledged. The server checks the same box.
 */
export function AccountDeletion() {
  const [open, setOpen] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  if (!open)
    return (
      <button
        type="button"
        className="account-danger-open"
        onClick={() => setOpen(true)}
      >
        계정 삭제
      </button>
    );
  return (
    <form
      action="/api/auth/account"
      method="post"
      className="account-danger"
      aria-label="계정 삭제"
    >
      <h2>계정을 삭제할까요?</h2>
      <p>
        보관한 이야기, 남겨둔 질문, 휴지통에 있는 기록, 진행 중인 대화가 모두
        함께 지워져요. 되돌릴 수 없고, 다시 가입해도 복구되지 않아요.
      </p>
      <label className="account-danger-confirm">
        <input
          type="checkbox"
          name="acknowledged"
          checked={acknowledged}
          onChange={(event) => setAcknowledged(event.target.checked)}
        />
        <span>되돌릴 수 없다는 점을 확인했어요.</span>
      </label>
      <div className="account-danger-actions">
        <button
          type="submit"
          className="account-danger-submit"
          disabled={!acknowledged}
        >
          계정 삭제하기
        </button>
        <ActionButton
          type="button"
          variant="ghost"
          onClick={() => {
            setOpen(false);
            setAcknowledged(false);
          }}
        >
          그만두기
        </ActionButton>
      </div>
      <p className="account-danger-note">
        무엇이 지워지는지는 <Link href="/privacy">개인정보처리방침</Link>에
        적어두었어요.
      </p>
    </form>
  );
}
