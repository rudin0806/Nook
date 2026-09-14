import Link from "next/link";
import { AppNavigation } from "@/components/nook/app-navigation";
import "../preview/preview.css";

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
    <div className="nook-preview">
      <header className="preview-header">
        <Link href="/" className="wordmark">
          nook<span>.</span>
        </Link>
      </header>
      <AppNavigation current="account" />
      <main id="main-content" className="preview-summary">
        <p className="preview-kicker">다시 꺼내 보고 싶을 때</p>
        <h1>내 이야기를 연결해 둘까요?</h1>
        <p className="preview-description">
          계정을 연결하면 보관한 이야기를 다시 찾아올 수 있어요. 지금 나누던
          대화가 있다면 같은 사용자에 연결해요.
        </p>
        {message && (
          <p role="alert" className="preview-status">
            {message}
          </p>
        )}
        <div className="preview-actions">
          <form action="/api/auth/start" method="post">
            <input type="hidden" name="provider" value="google" />
            <button className="login-button" type="submit">
              Google로 계속하기
            </button>
          </form>
        </div>
        <p>
          <Link href="/">지금은 이야기부터 할게요</Link>
        </p>
        <p>
          <Link href="/drawer">생각더미로 돌아가기</Link>
        </p>
        <form action="/api/auth/signout" method="post">
          <button className="login-button" type="submit">
            이 기기에서 로그아웃
          </button>
        </form>
      </main>
    </div>
  );
}
