import Link from "next/link";
import { AppNavigation } from "@/components/nook/app-navigation";
import { ThoughtInput } from "@/components/nook/thought-input";
export const dynamic = "force-dynamic";
export default function HomePage() {
  return (
    <div className="night-app">
      <header className="app-header">
        <Link href="/" className="app-wordmark" aria-label="Nook 홈">
          nook<span>.</span>
        </Link>
        <span className="app-header-note">생각을 위한 자리</span>
        <Link className="header-account" href="/login">
          내 계정
        </Link>
      </header>
      <AppNavigation current="write" />
      <main id="main-content" className="desk-main">
        <div className="desk-heading">
          <p className="preview-kicker">나의 작업 공간</p>
          <p className="desk-greeting">복잡한 생각을, 하나의 질문으로.</p>
        </div>
        <div className="desk-grid">
          <ThoughtInput
            showRecovery
            enabled={process.env.NOOK_START_API_ENABLED === "true"}
          />
          <aside className="desk-guide" aria-label="생각을 정리하는 방법">
            <span className="guide-label">한 번에 하나씩</span>
            <h2>
              답보다 먼저,
              <br />내 질문을 찾아요.
            </h2>
            <ol className="guide-steps">
              <li>
                <span>01</span>
                <div>
                  <h3>꺼내놓기</h3>
                  <p>정리되지 않은 말도 괜찮아요.</p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <h3>좁혀보기</h3>
                  <p>지금 가장 중요한 질문을 골라요.</p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <h3>남겨두기</h3>
                  <p>다시 보고 싶은 생각만 남겨요.</p>
                </div>
              </li>
            </ol>
            <Link href="/drawer" className="guide-link">
              내 생각 더미 <span aria-hidden="true">↗</span>
            </Link>
          </aside>
        </div>
        <p className="desk-footnote">
          결론이 나지 않아도 괜찮아요. 멈출 때는 내가 정해요.
        </p>
      </main>
    </div>
  );
}
