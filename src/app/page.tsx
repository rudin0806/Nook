import Link from "next/link";
import { AppNavigation } from "@/components/nook/app-navigation";
import { ThoughtInput } from "@/components/nook/thought-input";
import { ScrollStage } from "@/components/nook/scroll-stage";
import { PaperArt } from "@/components/nook/paper-art";
export const dynamic = "force-dynamic";
export default function HomePage() {
  return (
    <div className="night-app">
      <header className="app-header">
        <Link href="/" className="app-wordmark" aria-label="Nook 홈">
          nook<span>.</span>
        </Link>
        <span className="app-header-note">생각이 머물다 가는 작은 자리</span>
        <Link className="header-account" href="/login">
          내 계정 ↗
        </Link>
      </header>
      <AppNavigation current="write" />
      <main id="main-content">
        <ScrollStage>
          <section className="atelier-hero">
            <div className="hero-intro">
              <span className="edition-label">A LITTLE ROOM FOR THOUGHT</span>
              <p>답을 서두르지 않는 곳.</p>
            </div>
            <div className="hero-composition">
              <ThoughtInput
                enabled={process.env.NOOK_START_API_ENABLED === "true"}
              />
              <PaperArt />
            </div>
            <a className="scroll-cue" href="#nook-approach">
              <span>생각이 머무는 방식</span>
              <span aria-hidden="true">↓</span>
            </a>
          </section>
          <section id="nook-approach" className="approach-section reveal-panel">
            <div className="approach-side">
              <span className="section-index">01 / 꺼내놓기</span>
              <div className="margin-art" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
            </div>
            <div className="approach-copy">
              <h2>
                복잡한 생각에도
                <br />
                여백이 필요하니까.
              </h2>
              <p>
                한 번에 하나의 질문.
                <br />
                어디로 이어갈지는 내가 골라요.
              </p>
              <a href="#raw-thought" className="editorial-link">
                내 생각 적으러 가기 ↗
              </a>
            </div>
          </section>
          <section className="keep-section reveal-panel">
            <div className="keep-heading">
              <span className="section-index">02 / 남겨두기</span>
              <h2>
                모든 말을 남기기보다,
                <br />
                다시 보고 싶은 질문을.
              </h2>
              <Link href="/drawer" className="editorial-link">
                생각더미 열기 ↗
              </Link>
            </div>
            <div className="keeper-art" aria-hidden="true">
              <span>nook</span>
              <i />
              <i />
              <i />
            </div>
          </section>
        </ScrollStage>
      </main>
      <footer className="atelier-footer">
        <span className="footer-wordmark" aria-hidden="true">
          nook.
        </span>
        <div>
          <span>생각을 위한 작은 여백.</span>
          <a href="#main-content">위로 돌아가기 ↑</a>
        </div>
      </footer>
    </div>
  );
}
