import { SessionOrigin } from "@/components/nook/session-origin";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppNavigation } from "@/components/nook/app-navigation";
import { PageHeading } from "@/components/nook/page-heading";
import { SavedStoryContents } from "@/components/nook/saved-story-contents";
import { sessionIdSchema } from "@/schemas/retention";
import "../../preview/preview.css";
import { Wordmark } from "@/components/nook/wordmark";
import { readConsentState } from "@/lib/legal/gate";

export default async function SavedStoryPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const id = sessionIdSchema.safeParse((await params).sessionId);
  if (!id.success) notFound();
  // 목록은 막고 상세는 열려 있으면 재동의가 우회된다. /drawer·/talk과 같은 문을 쓴다.
  if ((await readConsentState()) === "reconsent")
    redirect(`/consent?returnTo=${encodeURIComponent(`/drawer/${id.data}`)}`);
  return (
    <div className="nook-preview">
      <header className="preview-header">
        <Wordmark />
        <Link className="header-account" href="/login">
          내 정보
        </Link>
      </header>
      <AppNavigation current="saved" />
      <main id="main-content" className="preview-summary">
        <Link className="account-return" href="/drawer">
          ← 생각 더미로 돌아가기
        </Link>
        <PageHeading kicker="내가 남겨둔 이야기" title="지나온 질문" />
        <SessionOrigin sessionId={id.data} />
        <SavedStoryContents key={id.data} sessionId={id.data} />
      </main>
    </div>
  );
}
