import Link from "next/link";
import { AppNavigation } from "@/components/nook/app-navigation";
import { HomeDesk } from "@/components/nook/home-desk";
import { PageHeading } from "@/components/nook/page-heading";
import { Wordmark } from "@/components/nook/wordmark";
import { redirect } from "next/navigation";
import { readConsentState } from "@/lib/legal/gate";
import { PolicyNotice } from "@/components/nook/policy-notice";
import { PreviewBand } from "@/components/nook/preview-band";
import { POLICY_NOTICE_VERSION } from "@/lib/legal/versions";
export const dynamic = "force-dynamic";
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>;
}) {
  const preview = (await searchParams).preview === "1";
  // Reading the documents and managing the account stay reachable, or agreeing
  // again would be impossible; the screens a member works in do not.
  const consent = await readConsentState();
  if (consent === "reconsent") redirect("/consent");
  return (
    <div className="night-app" data-sample={preview || undefined}>
      <header className="app-header">
        <Wordmark />
        <Link className="header-account" href="/login">
          내 정보
        </Link>
      </header>
      <AppNavigation current="write" />
      {consent === "notice" && <PolicyNotice version={POLICY_NOTICE_VERSION} />}
      <main id="main-content" className="desk-main">
        <PreviewBand on={preview} />
        <PageHeading
          kicker={preview ? "미리보기" : "새 대화"}
          title={
            preview ? "사용하면 이렇게 보여요" : "정리되지 않는 생각이 있나요?"
          }
          subtitle={preview ? "예시 화면이에요" : "떠오르는 생각을 적어보세요"}
        />
        <HomeDesk
          enabled={process.env.NOOK_START_API_ENABLED === "true"}
          preview={preview}
        />
      </main>
    </div>
  );
}
