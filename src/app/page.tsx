import Link from "next/link";
import { AppNavigation } from "@/components/nook/app-navigation";
import { ThoughtInput } from "@/components/nook/thought-input";
export default function HomePage() {
  return (
    <div className="night-app">
      <header className="app-header">
        <Link className="app-wordmark" href="/" aria-label="Nook 홈">
          nook<span>.</span>
        </Link>
        <span className="app-header-note">잠시, 나에게 집중하는 곳</span>
      </header>
      <AppNavigation current="write" />
      <main id="main-content" className="writing-main">
        <ThoughtInput />
      </main>
    </div>
  );
}
