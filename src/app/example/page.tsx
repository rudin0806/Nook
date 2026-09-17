import Link from "next/link";
import { StoryReader } from "@/components/nook/story-reader";
import { Wordmark } from "@/components/nook/wordmark";
import { exampleStory } from "@/lib/example/story";
import "../preview/preview.css";

/** Static on purpose. The example has no account, no session and no model call,
 * so there is nothing to read per request — and keeping it off the database is
 * what makes it impossible for these records to reach a real shelf.
 *
 * `data-sample` on the root is the whole visual treatment: the scope in
 * redesign.css redefines the surface, line and accent tokens, so every
 * component below renders as a sample without knowing anything about it. */
export const dynamic = "force-static";

export const metadata = {
  title: "Nook 예시",
  robots: { index: false, follow: false },
};

export default function ExamplePage() {
  return (
    <div className="nook-preview" data-sample>
      <p className="sample-band">
        <strong>예시예요</strong>
        <span>· 여기 있는 기록은 저장되지 않아요</span>
        <Link href="/">내 이야기 시작하기 →</Link>
      </p>
      <header className="preview-header">
        <Wordmark />
      </header>
      <main id="main-content" className="preview-summary">
        <h1>지나온 질문</h1>
        <p>
          {new Date(exampleStory.session.started_at).toLocaleDateString(
            "ko-KR",
            { timeZone: "Asia/Seoul" },
          )}
          에 시작한 이야기
        </p>
        <section aria-label="처음 적은 생각">
          <h2>처음 적은 생각</h2>
          <p>첫 질문을 확정하기 전에 남긴 기록이에요.</p>
          <p className="conversation-message">{exampleStory.initialThought}</p>
        </section>
        <StoryReader story={exampleStory} restartable={false} />
      </main>
    </div>
  );
}
