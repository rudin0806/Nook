import type { ReactNode } from "react";

/** 로그인과 가입이 같은 제공자 목록을 쓴다. 두 화면에 각각 적어 두면 하나만 고쳐진
 *  채로 갈라진다 — 온점이 세 군데서 되살아났던 것과 같은 자리다.
 *
 *  `intent`가 서버의 두 문을 가른다. `signup`은 동의를 받고 기록하며, `login`은
 *  둘 다 하지 않는다(개인정보 보호법 제22조는 가입 쪽에서 지킨다).
 */
export function ProviderButtons({
  intent,
  returnTo,
  agreed = true,
  children,
}: {
  intent: "login" | "signup";
  returnTo: string;
  /** 가입 화면에서 동의가 아직 안 찼으면 눌리지 않는다. */
  agreed?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="provider-buttons">
      {children}
      {(["google", "kakao"] as const).map((provider) => (
        <form action="/api/auth/start" method="post" key={provider}>
          <input type="hidden" name="provider" value={provider} />
          <input type="hidden" name="intent" value={intent} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <input type="hidden" name="agreed" value={agreed ? "on" : ""} />
          <button
            className={provider === "google" ? "google-button" : "kakao-button"}
            type="submit"
            disabled={!agreed}
          >
            <span aria-hidden="true">{provider === "google" ? "G" : "K"}</span>
            {provider === "google" ? "Google" : "카카오"}로{" "}
            {intent === "signup" ? "시작하기" : "로그인"}
            <span aria-hidden="true">↗</span>
          </button>
        </form>
      ))}
    </div>
  );
}
