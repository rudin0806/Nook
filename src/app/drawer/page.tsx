import { AppNavigation } from "@/components/nook/app-navigation";
import { DrawerContents } from "@/components/nook/drawer-contents";
import "../preview/preview.css";
import { Wordmark } from "@/components/nook/wordmark";
import { PageHeading } from "@/components/nook/page-heading";
import { redirect } from "next/navigation";
import { readConsentState } from "@/lib/legal/gate";
import { PolicyNotice } from "@/components/nook/policy-notice";
import { POLICY_NOTICE_VERSION } from "@/lib/legal/versions";

export default async function DrawerPage({
  searchParams,
}: {
  searchParams: Promise<{ collection?: string }>;
}) {
  const consent = await readConsentState();
  if (consent === "reconsent")
    redirect(`/consent?returnTo=${encodeURIComponent("/drawer")}`);
  const { collection } = await searchParams;
  const initialCollection =
    collection === "trash"
      ? "trash"
      : collection === "questions"
        ? "questions"
        : collection === "recovery"
          ? "recovery"
          : "sessions";
  return (
    <div className="nook-preview">
      <header className="preview-header">
        <Wordmark />
      </header>
      <AppNavigation current="saved" />
      {consent === "notice" && <PolicyNotice version={POLICY_NOTICE_VERSION} />}
      <main id="main-content" className="preview-summary collection-workspace">
        <PageHeading
          kicker="내가 남겨둔 이야기"
          title="생각 더미"
          subtitle="지나온 질문을 다시 펼쳐보는 자리"
        />
        <DrawerContents
          initialCollection={initialCollection}
          key={initialCollection}
        />
      </main>
    </div>
  );
}
