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
import { PreviewDrawer } from "@/components/nook/preview-drawer";
import { POLICY_NOTICE_VERSION } from "@/lib/legal/versions";

export default async function DrawerPage({
  searchParams,
}: {
  searchParams: Promise<{ collection?: string; preview?: string }>;
}) {
  const { collection, preview: previewParam } = await searchParams;
  // 미리보기에도 표본 책장을 둔다. 위쪽 띠가 "내 기록이 아니다"를 이미 말하므로,
  // 빈 화면은 이제 그 사실이 아니라 "여기는 아무것도 없는 곳"으로 읽힌다.
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
      <header className="preview-header">
        <Wordmark />
        <Link className="header-account" href="/login">
          내 정보
        </Link>
      </header>
      <AppNavigation current="saved" />
      {consent === "notice" && <PolicyNotice version={POLICY_NOTICE_VERSION} />}
      <main id="main-content" className="preview-summary collection-workspace">
        {preview && <PreviewBand on />}
        <PageHeading
          kicker="내가 남긴 이야기"
          title="생각 더미"
          subtitle={
            preview ? "사용하면 이렇게 보여요" : "지난 생각을 확인해보세요"
          }
        />
        {preview ? (
          <PreviewDrawer initialCollection={initialCollection} />
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
