import { authReturnPath } from "@/lib/auth/return-path";
import Link from "next/link";
import { AccountPanel } from "@/components/nook/account-panel";
import { Wordmark } from "@/components/nook/wordmark";

const messages: Record<string, string> = {
  cancelled: "로그인을 취소했어요. 원할 때 다시 연결해 주세요.",
  provider:
    "로그인 서비스에서 연결을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.",
  expired:
    "로그인 시간이 지났거나 시작 정보를 확인하지 못했어요. 아래에서 다시 시작해 주세요.",
  exchange:
    "로그인 정보를 확인하지 못했어요. 아래에서 로그인을 다시 시작해 주세요.",
  start: "로그인을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.",
  callback: "로그인이 완료되지 않았어요. 아래에서 다시 연결해 주세요.",
  session: "현재 로그인 상태를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.",
  identity:
    "같은 사용자로 계정 연결을 확인하지 못했어요. 기록은 다른 계정으로 옮기지 않았어요.",
  anonymous:
    "아직 계정에 연결하지 않은 대화가 있어요. 기록을 남기려면 먼저 계정을 연결해 주세요.",
  signout: "로그아웃하지 못했어요. 다시 시도해 주세요.",
  delete_confirm: "삭제를 진행하려면 되돌릴 수 없다는 확인란을 체크해 주세요.",
  delete:
    "계정을 삭제하지 못했어요. 기록은 그대로 있어요. 잠시 후 다시 시도해 주세요.",
  rejoin_blocked:
    "탈퇴한 계정이에요. 같은 방법으로는 탈퇴일로부터 30일이 지난 뒤에 다시 가입할 수 있어요.",
  consent: "필수 항목에 모두 동의해야 계정을 만들 수 있어요.",
};
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    returnTo?: string;
    deleted?: string;
  }>;
}) {
  const { error, returnTo: candidate, deleted } = await searchParams;
  const returnTo = authReturnPath(candidate);
  const message =
    error && Object.hasOwn(messages, error) ? messages[error] : null;
  return (
    <div className="account-page">
      <header className="app-header">
        <Wordmark />
      </header>
      <main id="main-content" className="account-layout">
        {/* 되돌아가는 길은 하나이고, 패널을 다 읽어 내려가기 전에 보이는 자리에
            둔다. 헤더 오른쪽 끝의 `닫기 ×`와 패널 맨 아래 링크로 나뉘어 있어서
            같은 일을 하는 것이 둘이었고, 아래 것은 계정 삭제 밑에 있었다. */}
        <Link
          className="account-return"
          href={returnTo === "/drawer" ? "/" : returnTo}
        >
          ←{" "}
          {returnTo === "/drawer"
            ? "생각 쓰기로 돌아가기"
            : "보관 선택으로 돌아가기"}
        </Link>
        {deleted === "1" && (
          <p className="account-farewell" role="status">
            계정과 기록을 모두 삭제했어요. 그동안 여기 적어둔 생각은 남아 있지
            않아요.
          </p>
        )}
        <AccountPanel message={message} returnTo={returnTo} />
      </main>
      <footer className="account-footer">
        a little room for your thoughts.
      </footer>
    </div>
  );
}
