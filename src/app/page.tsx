import Link from "next/link";
import { ThoughtInput } from "@/components/nook/thought-input";

export default function HomePage() {
  return (
    <div className="home">
      <header className="site-header">
        <Link className="wordmark" href="/" aria-label="Nook 홈">
          nook<span>.</span>
        </Link>
        <nav className="home-nav" aria-label="주 메뉴">
          <Link href="/" aria-current="page">
            이야기 나누기
          </Link>
          <Link href="/drawer">생각더미</Link>
          <Link href="/preview">화면 시안</Link>
        </nav>
      </header>
      <main id="main-content" className="thought-space">
        <p className="eyebrow">지금, 내 머릿속</p>
        <h1>
          무슨 생각
          <br className="mobile-break" /> 하고 있었어요?
        </h1>
        <p className="introduction">두서없어도 괜찮아요. 편하게 들려주세요.</p>
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
