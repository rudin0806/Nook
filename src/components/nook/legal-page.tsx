import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "./wordmark";

/** Shared frame for the two published policies. */
export function LegalPage({
  title,
  effectiveFrom,
  children,
}: {
  title: string;
  effectiveFrom: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="legal-page">
      <header className="app-header">
        <Wordmark />
        <Link className="header-account" href="/">
          닫기 ×
        </Link>
      </header>
      <main id="main-content" className="legal-main">
        <h1>{title}</h1>
        <p className="legal-updated">시행일: {effectiveFrom}</p>
        {children}
        <nav className="legal-footer-links" aria-label="정책 문서">
          <Link href="/terms">이용약관</Link>
          <Link href="/privacy">개인정보처리방침</Link>
          <Link href="/">홈으로</Link>
        </nav>
      </main>
    </div>
  );
}
