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
import { PreviewBand } from "@/components/nook/preview-band";
import { StoryReader } from "@/components/nook/story-reader";
import { exampleStories } from "@/lib/example/story";

export default async function SavedStoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const id = sessionIdSchema.safeParse((await params).sessionId);
  if (!id.success) notFound();
  // 미리보기는 표본을 읽고 데이터베이스에 닿지 않는다. 책장에서 넘어온 그 책의
  // 이야기만 연다 — 아이디가 표본에 없으면 미리보기가 아니다.
  const preview =
    (await searchParams).preview === "1" && !!exampleStories[id.data];
  // 목록은 막고 상세는 열려 있으면 재동의가 우회된다. /drawer·/talk과 같은 문을 쓴다.
  if (!preview && (await readConsentState()) === "reconsent")
    redirect(`/consent?returnTo=${encodeURIComponent(`/drawer/${id.data}`)}`);
  return (
    <div className="nook-preview" data-sample={preview || undefined}>
      <header className="preview-header">
        <Wordmark />
        <Link className="header-account" href="/login">
          내 정보
        </Link>
      </header>
      <AppNavigation current="saved" />
      <main id="main-content" className="preview-summary">
        <Link
          className="account-return"
          href={preview ? "/drawer?preview=1" : "/drawer"}
        >
          ← 생각 더미로 돌아가기
        </Link>
        {preview && <PreviewBand on />}
        <PageHeading kicker="내가 남겨둔 이야기" title="지나온 질문" />
        {preview ? (
          <StoryReader story={exampleStories[id.data]} restartable={false} />
        ) : (
          <>
            <SessionOrigin sessionId={id.data} />
            <SavedStoryContents key={id.data} sessionId={id.data} />
          </>
        )}
      </main>
    </div>
  );
}
