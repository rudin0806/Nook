import Link from "next/link";
import { ProviderButtons } from "./provider-buttons";

/** 로그인 화면.
 *
 * 전에는 이 자리에 가입 화면 하나만 있었다. 그래서 돌아온 회원도 들어올 때마다
 * 동의 세 칸을 다시 체크해야 했다 — 동의는 가입 때 한 번 받는 것이고, 매번 묻는
 * 체크박스는 동의를 형식으로 만든다.
 *
 * 여기서는 묻지 않고 기록하지도 않는다. 동의 기록이 없는 채로 들어오면 홈·대화·
 * 서랍의 게이트가 `/consent`로 보내 거기서 받는다.
 */
export function SignInGate({ returnTo }: { returnTo: string }) {
  const signup =
    returnTo === "/drawer"
      ? "/signup"
      : `/signup?returnTo=${encodeURIComponent(returnTo)}`;
  return (
    <div className="sign-in-gate">
      <ProviderButtons intent="login" returnTo={returnTo} />
      <p className="account-switch">
        처음이신가요? <Link href={signup}>가입하기</Link>
      </p>
    </div>
  );
}
