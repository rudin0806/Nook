import Link from "next/link";
import { AppNavigation } from "@/components/nook/app-navigation";
import { HomeDesk } from "@/components/nook/home-desk";
import { Wordmark } from "@/components/nook/wordmark";
import { redirect } from "next/navigation";
import { readConsentState } from "@/lib/legal/gate";
import { PolicyNotice } from "@/components/nook/policy-notice";
import { POLICY_NOTICE_VERSION } from "@/lib/legal/versions";
export const dynamic = "force-dynamic";
export default async function HomePage() {
  // Reading the documents and managing the account stay reachable, or agreeing
  // again would be impossible; the screens a member works in do not.
  const consent = await readConsentState();
  if (consent === "reconsent") redirect("/consent");
  return (
    <div className="night-app">
      <header className="app-header">
        <Wordmark />
        <span className="app-header-note">생각을 위한 자리</span>
        <Link className="header-account" href="/login">
          내 정보
        </Link>
      </header>
      <AppNavigation current="write" />
      {consent === "notice" && <PolicyNotice version={POLICY_NOTICE_VERSION} />}
      <main id="main-content" className="desk-main">
        <div className="desk-heading">
          <p className="preview-kicker">새 대화</p>
          <h1 className="desk-greeting">머릿속에 걸리는 게 있나요?</h1>
          <p className="desk-intro">
            정리되지 않아도 괜찮아요. 생각나는 대로 적어보세요.
          </p>
        </div>
        <HomeDesk enabled={process.env.NOOK_START_API_ENABLED === "true"} />
        <p className="desk-footnote">
          결론이 나지 않아도 괜찮아요. 멈출 때는 내가 정해요.
        </p>
      </main>
    </div>
  );
}
