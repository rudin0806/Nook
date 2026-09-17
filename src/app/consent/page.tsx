import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Wordmark } from "@/components/nook/wordmark";
import { readConsentState } from "@/lib/legal/gate";
import { consentReturnPath } from "@/lib/legal/return-path";
import { ConsentAgainForm } from "@/components/nook/consent-again-form";
import "../legal.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "약관이 바뀌었어요 — Nook",
  description: "바뀐 이용약관과 개인정보처리방침에 다시 동의해 주세요.",
};

export default async function ConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; error?: string }>;
}) {
  const { returnTo: candidate, error } = await searchParams;
  const returnTo = consentReturnPath(candidate);
  // Nobody should be able to sit on this screen once they have agreed.
  if ((await readConsentState()) !== "reconsent") redirect(returnTo);
  return (
    <div className="legal-page">
      <header className="app-header">
        <Wordmark />
      </header>
      <main id="main-content" className="legal-main consent-again">
        <h1>다시 한 번 확인이 필요해요</h1>
        <p className="legal-updated">시행일: 2026년 9월 19일</p>
        <p>
          이용약관과 개인정보처리방침이 바뀌었어요. 개인정보를 어떻게 다루는지에
          영향을 주는 변경이라, 계속 이용하시기 전에 동의를 다시 받아야 해요.
        </p>
        <div className="legal-callout">
          <p>
            지금까지 보관한 이야기와 남겨둔 질문은 그대로 있어요. 동의하지
            않으시면 서비스를 계속 이용할 수 없지만,{" "}
            <Link href="/login">내 정보</Link>에서 언제든 계정을 삭제하실 수
            있어요.
          </p>
        </div>
        <h2>무엇을 확인해야 하나요</h2>
        <ul>
          <li>
            <Link href="/terms">이용약관</Link> — 서비스가 무엇을 하고 무엇을
            하지 않는지, 계정과 금지 행위
          </li>
          <li>
            <Link href="/privacy">개인정보처리방침</Link> — 수집 항목, 보유
            기간, 국외 이전, 자동화된 결정
          </li>
        </ul>
        {error === "agree" && (
          <p role="alert" className="account-error">
            필수 항목에 동의해야 계속 이용할 수 있어요.
          </p>
        )}
        <ConsentAgainForm returnTo={returnTo} />
      </main>
    </div>
  );
}
