import Link from "next/link";
import { AppNavigation } from "@/components/nook/app-navigation";
import { DrawerContents } from "@/components/nook/drawer-contents";
import "../preview/preview.css";

export default async function DrawerPage({
  searchParams,
}: {
  searchParams: Promise<{ collection?: string }>;
}) {
  const { collection } = await searchParams;
  const initialCollection =
    collection === "trash"
      ? "trash"
      : collection === "questions"
        ? "questions"
        : "sessions";
  return (
    <div className="nook-preview">
      <header className="preview-header">
        <Link href="/" className="wordmark">
          nook<span>.</span>
        </Link>
      </header>
      <AppNavigation current="saved" />
      <main id="main-content" className="preview-summary collection-workspace">
        <p className="preview-kicker">내가 남겨둔 이야기</p>
        <h1>생각 더미</h1>
        <p className="preview-description">지나온 질문을 다시 펼쳐보는 자리.</p>
        <DrawerContents
          initialCollection={initialCollection}
          key={initialCollection}
        />
        <p>
          <Link href="/login">계정 연결 · 로그아웃</Link>
        </p>
      </main>
    </div>
  );
}
