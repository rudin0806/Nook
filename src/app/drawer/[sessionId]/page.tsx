import Link from "next/link";
import { notFound } from "next/navigation";
import { AppNavigation } from "@/components/nook/app-navigation";
import { SavedStoryContents } from "@/components/nook/saved-story-contents";
import { sessionIdSchema } from "@/schemas/retention";
import "../../preview/preview.css";
export default async function SavedStoryPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const id = sessionIdSchema.safeParse((await params).sessionId);
  if (!id.success) notFound();
  return (
    <div className="nook-preview">
      <header className="preview-header">
        <Link href="/" className="wordmark">
          nook<span>.</span>
        </Link>
      </header>
      <AppNavigation current="saved" />
      <main id="main-content" className="preview-summary">
        <p>
          <Link href="/drawer">생각더미로 돌아가기</Link>
        </p>
        <h1>지나온 질문</h1>
        <SavedStoryContents key={id.data} sessionId={id.data} />
      </main>
    </div>
  );
}
