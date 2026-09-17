"use client";
import { useSyncExternalStore } from "react";
import Link from "next/link";

const SEEN_KEY = "nook-policy-notice-seen-v1";

/** Read as an external store rather than copied into state after mount, so a
 * reader who already dismissed the notice never sees it flash back.
 */
const listeners = new Set<() => void>();
function subscribe(notify: () => void) {
  listeners.add(notify);
  window.addEventListener("storage", notify);
  return () => {
    listeners.delete(notify);
    window.removeEventListener("storage", notify);
  };
}
function readSeen(): string {
  try {
    return localStorage.getItem(SEEN_KEY) ?? "";
  } catch {
    return "";
  }
}
function markSeen(version: string) {
  try {
    localStorage.setItem(SEEN_KEY, version);
  } catch {}
  for (const notify of listeners) notify();
}

/** A revision that does not change what is collected is announced rather than
 * blocking. Dismissal is per browser, which is all this needs to be: the
 * blocking path is the one that has to be recorded.
 */
export function PolicyNotice({ version }: { version: string }) {
  const seen = useSyncExternalStore(subscribe, readSeen, () => version);
  if (seen === version) return null;
  return (
    <div className="policy-notice" role="status">
      <p>
        <Link href="/terms">이용약관</Link>과{" "}
        <Link href="/privacy">개인정보처리방침</Link>의 문구가 일부 바뀌었어요.
        수집하는 정보나 목적은 그대로예요.
      </p>
      <button type="button" onClick={() => markSeen(version)}>
        확인
      </button>
    </div>
  );
}
