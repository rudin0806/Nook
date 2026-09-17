"use client";
import { useState } from "react";
import Link from "next/link";

/** 개인정보 보호법 제22조 asks for each item to be agreed to separately, so the
 * re-consent screen keeps the same two boxes as sign-up rather than collapsing
 * them into one "I agree".
 */
export function ConsentAgainForm({ returnTo }: { returnTo: string }) {
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const both = terms && privacy;
  return (
    <form action="/api/auth/consent" method="post" className="consent-gate">
      <input type="hidden" name="returnTo" value={returnTo} />
      <input type="hidden" name="agreed" value={both ? "on" : ""} />
      <fieldset className="consent-list">
        <legend>계속 이용하려면</legend>
        <label className="consent-item">
          <input
            type="checkbox"
            checked={terms}
            onChange={(event) => setTerms(event.target.checked)}
          />
          <span>
            <em>[필수]</em> 바뀐 <Link href="/terms">이용약관</Link>에
            동의합니다.
          </span>
        </label>
        <label className="consent-item">
          <input
            type="checkbox"
            checked={privacy}
            onChange={(event) => setPrivacy(event.target.checked)}
          />
          <span>
            <em>[필수]</em> 바뀐 <Link href="/privacy">개인정보처리방침</Link>에
            따른 개인정보 수집·이용에 동의합니다.
          </span>
        </label>
      </fieldset>
      <button className="google-button" type="submit" disabled={!both}>
        동의하고 계속하기
        <span aria-hidden="true">↗</span>
      </button>
    </form>
  );
}
