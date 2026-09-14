import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ConversationPanel } from "@/components/nook/conversation-panel";
import "../../preview/preview.css";
export default async function TalkPage({
  params,
}: {
  params: Promise<{ nodeId: string }>;
}) {
  const id = z.uuid().safeParse((await params).nodeId);
  if (!id.success) notFound();
  return (
    <div className="nook-preview">
      <header className="preview-header">
        <Link href="/" className="wordmark">
          nook<span>.</span>
        </Link>
      </header>
      <main id="main-content" className="preview-summary">
        <ConversationPanel key={id.data} nodeId={id.data} />
      </main>
    </div>
  );
}
