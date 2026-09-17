import Link from "next/link";
import type { ReactNode } from "react";

/** Shared frame for the two published policies. The operator fields are left as
 * marked placeholders rather than invented: a policy that names the wrong
 * controller is worse than one that is visibly unfinished.
 */
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
        <Link className="app-wordmark" href="/" aria-label="Nook 홈">
          <span className="logo-n">N</span>
          <span className="logo-wide">ook</span>
        </Link>
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

export function Pending({ children }: { children: ReactNode }) {
  return <span className="legal-pending">{children}</span>;
}
