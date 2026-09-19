import Link from "next/link";
import { AppNavigation } from "@/components/nook/app-navigation";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { ConversationPanel } from "@/components/nook/conversation-panel";
import "../../preview/preview.css";
import { Wordmark } from "@/components/nook/wordmark";
import { readConsentState } from "@/lib/legal/gate";
import { PREVIEW_NODE_ID } from "@/lib/example/preview";
import { PreviewBand } from "@/components/nook/preview-band";
export default async function TalkPage({
  params,
  searchParams,
}: {
  params: Promise<{ nodeId: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const id = z.uuid().safeParse((await params).nodeId);
  if (!id.success) notFound();
  // 미리보기는 표본만 연다. 주소에 preview를 붙였다고 남의 대화가 열리지 않도록,
  // 표본으로 정해 둔 노드일 때만 미리보기로 친다.
  const preview =
    (await searchParams).preview === "1" && id.data === PREVIEW_NODE_ID;
  if (!preview && (await readConsentState()) === "reconsent")
    redirect(`/consent?returnTo=${encodeURIComponent(`/talk/${id.data}`)}`);
  return (
    <div className="nook-preview" data-sample={preview || undefined}>
      {preview && <PreviewBand />}
      <header className="preview-header">
        <Wordmark />
        <Link className="header-account" href="/login">
          내 정보
        </Link>
      </header>
      <AppNavigation current="write" />
      <main
        id="main-content"
        className="preview-summary conversation-workspace"
      >
        <ConversationPanel key={id.data} nodeId={id.data} preview={preview} />
      </main>
    </div>
  );
}
