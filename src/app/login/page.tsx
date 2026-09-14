import Link from "next/link";
import { AccountPanel } from "@/components/nook/account-panel";
import { PaperArt } from "@/components/nook/paper-art";
const messages: Record<string, string> = {
  start: "로그인을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.",
  callback: "로그인이 완료되지 않았어요. 아래에서 다시 연결해 주세요.",
  session: "현재 로그인 상태를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.",
  identity:
    "같은 사용자로 계정 연결을 확인하지 못했어요. 기록은 다른 계정으로 옮기지 않았어요.",
  anonymous:
    "아직 계정에 연결하지 않은 대화가 있어요. 기록을 남기려면 먼저 계정을 연결해 주세요.",
  signout: "로그아웃하지 못했어요. 다시 시도해 주세요.",
};
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const message =
    error && Object.hasOwn(messages, error) ? messages[error] : null;
  return (
    <div className="account-page">
      <header className="app-header">
        <Link className="app-wordmark" href="/" aria-label="Nook 홈">
          nook<span>.</span>
        </Link>
        <Link className="header-account" href="/">
          닫기 ×
        </Link>
      </header>
      <main id="main-content" className="account-layout">
        <div className="account-art">
          <PaperArt compact />
          <p>
            다시 펼치고 싶은
            <br />
            나의 생각들.
          </p>
        </div>
        <AccountPanel message={message} />
      </main>
      <footer className="account-footer">
        a little room for your thoughts.
      </footer>
    </div>
  );
}
