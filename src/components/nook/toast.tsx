"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

/** 방금 일어난 일을 알리고 사라지는 자리.
 *
 * 이런 문장은 화면에 눌러앉을 이유가 없다. "3번째 자리에 저장했어요"가 탭 아래에
 * 남아 있으면 읽는 사람은 그것을 이 화면의 상태로 읽고, 다음에 무엇을 해야 하는지
 * 찾는다. 결과를 말하고 물러나는 것이 맞다.
 *
 * SEED의 Snackbar는 앱 루트에 provider가 있어야 하고, 그러려면 서버 컴포넌트인
 * 루트에 클라이언트 경계를 하나 세워야 한다. 알림 한 줄에 그만한 값을 치르지 않는다.
 */
export type ToastNotice = {
  /** 같은 문장이 다시 떠도 시간이 새로 시작되도록 회차를 센다. */
  id: number;
  text: string;
  action?: { href: string; label: string };
};

/** 링크가 붙은 알림은 읽고 누를 시간이 필요하다. */
const PLAIN_MS = 3400;
const ACTION_MS = 8000;

export function Toast({
  notice,
  onDismiss,
}: {
  notice: ToastNotice | null;
  onDismiss: () => void;
}) {
  // 부모가 매번 새 함수를 넘겨도 시간이 처음부터 다시 흐르면 안 된다.
  const dismiss = useRef(onDismiss);
  useEffect(() => {
    dismiss.current = onDismiss;
  });
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(
      () => dismiss.current(),
      notice.action ? ACTION_MS : PLAIN_MS,
    );
    return () => clearTimeout(timer);
  }, [notice]);

  // 읽어 주는 영역은 내용보다 먼저 있어야 한다. 알림과 함께 생기면 그때 들어온
  // 문장을 새 내용으로 보지 않아 읽히지 않는다.
  return (
    <div className="toast-layer" aria-live="polite">
      {notice && (
        <div className="toast" role="status" key={notice.id}>
          <p>{notice.text}</p>
          {notice.action && (
            <Link href={notice.action.href}>{notice.action.label}</Link>
          )}
          <button
            type="button"
            className="toast-close"
            aria-label="알림 닫기"
            onClick={onDismiss}
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
      )}
    </div>
  );
}
