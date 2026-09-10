import Link from "next/link";
import { ThoughtInput } from "@/components/nook/thought-input";

export default function HomePage() {
  return (
    <div className="home">
      <header className="site-header">
        <Link className="wordmark" href="/" aria-label="Nook 홈">
          nook<span>.</span>
        </Link>
        <span className="header-note">생각을 잠시 놓아두는 곳</span>
      </header>
      <main id="main-content" className="thought-space">
        <p className="eyebrow">지금, 내 머릿속</p>
        <h1>
          머릿속에
          <br className="mobile-break" /> 걸리는 게 있나요?
        </h1>
        <p className="introduction">정리하지 말고 생각나는 대로 적어주세요.</p>
        <ThoughtInput />
        <p className="release-note">
          지금은 첫 화면을 준비하고 있어요. 대화와 저장은 아직 지원하지 않아요.
        </p>
      </main>
      <footer className="site-footer">
        답을 주는 대신, 내가 어떤 질문을 지나왔는지.
      </footer>
    </div>
  );
}
