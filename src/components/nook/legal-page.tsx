import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "./wordmark";
import { AppNavigation } from "./app-navigation";
import { PageHeading } from "./page-heading";

/** Shared frame for the two published policies.
 *
 * These pages used to have no navigation at all — a lone 닫기 × — so a reader
 * who arrived from a link had no way to the rest of the product. They carry the
 * same tab row as every other screen now, and the same heading block, so a
 * policy does not read like a different site.
 */
export function LegalPage({
  title,
  kicker,
  subtitle,
  effectiveFrom,
  children,
}: {
  title: string;
  kicker: string;
  subtitle: string;
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
      <AppNavigation current="account" />
      <main id="main-content" className="legal-main">
        <PageHeading kicker={kicker} title={title} subtitle={subtitle}>
          <p className="legal-updated">시행일: {effectiveFrom}</p>
        </PageHeading>
        {children}
        <nav className="legal-footer-links" aria-label="정책 문서">
          <Link className="quiet-link" href="/terms">
            이용약관
          </Link>
          <Link className="quiet-link" href="/privacy">
            개인정보처리방침
          </Link>
          <Link className="quiet-link" href="/">
            홈으로
          </Link>
        </nav>
      </main>
    </div>
  );
}
