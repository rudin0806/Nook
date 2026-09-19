import Link from "next/link";
import { AppNavigation } from "@/components/nook/app-navigation";
import { DrawerContents } from "@/components/nook/drawer-contents";
import "../preview/preview.css";
import { Wordmark } from "@/components/nook/wordmark";
import { PageHeading } from "@/components/nook/page-heading";
import { redirect } from "next/navigation";
import { readConsentState } from "@/lib/legal/gate";
import { PolicyNotice } from "@/components/nook/policy-notice";
import { PreviewBand } from "@/components/nook/preview-band";
import { PreviewDrawerEmpty } from "@/components/nook/preview-drawer-empty";
import { POLICY_NOTICE_VERSION } from "@/lib/legal/versions";

export default async function DrawerPage({
  searchParams,
}: {
  searchParams: Promise<{ collection?: string; preview?: string }>;
}) {
  const { collection, preview: previewParam } = await searchParams;
  // 미리보기에는 쌓인 기록이 없다. 빈 화면이 그 사실을 가장 정확하게 말한다.
  const preview = previewParam === "1";
  const consent = preview ? "ok" : await readConsentState();
  if (consent === "reconsent")
    redirect(`/consent?returnTo=${encodeURIComponent("/drawer")}`);
  const initialCollection =
    collection === "trash"
      ? "trash"
      : collection === "recovery"
        ? "recovery"
        : "sessions";
  return (
    <div className="nook-preview" data-sample={preview || undefined}>
      {preview && <PreviewBand />}
      <header className="preview-header">
        <Wordmark />
        <Link className="header-account" href="/login">
          내 정보
        </Link>
      </header>
      <AppNavigation current="saved" />
      {consent === "notice" && <PolicyNotice version={POLICY_NOTICE_VERSION} />}
      <main id="main-content" className="preview-summary collection-workspace">
        <PageHeading
          kicker="내가 남겨둔 이야기"
          title="생각 더미"
          subtitle={
            preview
              ? "남긴 이야기가 여기에 쌓여요"
              : "지나온 질문을 다시 펼쳐봐요"
          }
        />
        {preview ? (
          <PreviewDrawerEmpty />
        ) : (
          <DrawerContents
            initialCollection={initialCollection}
            key={initialCollection}
          />
        )}
      </main>
    </div>
  );
}
