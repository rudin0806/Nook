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
            책상
          </Link>
          <Link href="/drawer">생각더미</Link>
          <Link href="/login">계정</Link>
        </nav>
        <span className="preview-edition">a little room for thought</span>
      </header>
      <main id="main-content" className="desk-main">
        <section className="desk-intro">
          <p className="eyebrow">잠깐, 내 생각에 머무는 시간</p>
          <h1>
            어떤 이야기부터
            <br />
            꺼내볼까요?
          </h1>
          <div className="desk-light" aria-hidden="true">
            <span />
          </div>
        </section>
        <ThoughtInput />
        <section className="desk-section home-library">
          <div className="section-heading">
            <div>
              <p className="eyebrow">다시 펼쳐볼 수 있도록</p>
              <h2>생각더미</h2>
            </div>
            <Link className="text-button" href="/drawer">
              내 기록 열기 ↗
            </Link>
          </div>
          <div className="bookshelf" aria-hidden="true">
            <div className="book-row empty-shelf">
              <div className="book-outline" />
              <div className="book-outline" />
              <span>이야기를 놓아둘 자리</span>
            </div>
            <div className="shelf-edge" />
          </div>
          <p className="preview-caption">
            보관한 기록과 남겨둔 질문은 내 기록에서 확인해요.
          </p>
        </section>
      </main>
      <footer className="site-footer">생각이 머물다 가는 작은 자리.</footer>
    </div>
  );
}
