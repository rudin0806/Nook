import Link from "next/link";
import { AppNavigation } from "@/components/nook/app-navigation";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { ConversationPanel } from "@/components/nook/conversation-panel";
import "../../preview/preview.css";
import { Wordmark } from "@/components/nook/wordmark";
import { readConsentState } from "@/lib/legal/gate";
export default async function TalkPage({
  params,
}: {
  params: Promise<{ nodeId: string }>;
}) {
  const id = z.uuid().safeParse((await params).nodeId);
  if (!id.success) notFound();
  if ((await readConsentState()) === "reconsent")
    redirect(`/consent?returnTo=${encodeURIComponent(`/talk/${id.data}`)}`);
  return (
    <div className="nook-preview">
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
        <ConversationPanel key={id.data} nodeId={id.data} />
      </main>
    </div>
  );
}
