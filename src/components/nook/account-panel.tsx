"use client";
import { useEffect, useState } from "react";
import { ActionButton } from "@seed-design/react";
import { PageHeading } from "./page-heading";
import { NicknameForm } from "./nickname-form";
import { AccountDeletion } from "./account-deletion";
import { ConsentGate } from "./consent-gate";
import { SignInGate } from "./sign-in-gate";
import { readNickname } from "@/schemas/profile";
import { providerLabel } from "@/lib/auth/policy";
export function AccountPanel({
  message,
  returnTo = "/drawer",
  intent = "login",
}: {
  message: string | null;
  returnTo?: string;
  /** 로그아웃 상태에서 어느 문을 보여 줄지. 로그인한 사람에게는 상관이 없다. */
  intent?: "login" | "signup";
}) {
  const [nickname, setNickname] = useState<string | null>(null);
  const [account, setAccount] = useState<{
    email: string | null;
    provider: string | null;
  }>({ email: null, provider: null });
  const [state, setState] = useState<
    "loading" | "signed_in" | "signed_out" | "unavailable"
  >("loading");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/auth/status", {
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const body: unknown = await response.json();
        if (
          !response.ok ||
          typeof body !== "object" ||
          body === null ||
          !("state" in body) ||
          (body.state !== "signed_in" && body.state !== "signed_out")
        )
          throw new Error("UNAVAILABLE");
        if (!controller.signal.aborted) {
          setState(body.state);
          setNickname(readNickname("nickname" in body ? body.nickname : null));
          setAccount({
            email:
              "email" in body && typeof body.email === "string"
                ? body.email
                : null,
            provider:
              "provider" in body && typeof body.provider === "string"
                ? body.provider
                : null,
          });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setState("unavailable");
      });
    return () => controller.abort();
  }, [attempt]);
  return (
    <section className="account-panel" aria-busy={state === "loading"}>
      <PageHeading
        kicker="내 정보"
        title={
          state === "signed_in"
            ? "다시 만나 반가워요"
            : intent === "signup"
              ? "내 생각을, 내 자리에"
              : "다시 오셨네요"
        }
        subtitle={
          state === "signed_in"
            ? "남겨둔 질문들이 여기 있어요"
            : intent === "signup"
              ? "보관한 생각을 다시 펼쳐보는 계정"
              : "남겨둔 생각이 그대로 기다리고 있어요"
        }
      />
      {message && (
        <p role="alert" className="account-error">
          {message}
        </p>
      )}
      {state === "loading" ? (
        <p className="account-loading" role="status">
          계정을 확인하고 있어요…
        </p>
      ) : state === "unavailable" ? (
        <div className="account-loading" role="status">
          <p>계정을 확인하지 못했어요.</p>
          <ActionButton
            variant="neutralWeak"
            onClick={() => {
              setState("loading");
              setAttempt((n) => n + 1);
            }}
          >
            다시 확인
          </ActionButton>
        </div>
      ) : state === "signed_out" ? (
        intent === "signup" ? (
          <ConsentGate returnTo={returnTo} />
        ) : (
          <SignInGate returnTo={returnTo} />
        )
      ) : (
        <>
          {/* 어느 계정으로 들어와 있는지가 이 화면에서 가장 먼저 답해야 할 질문이다.
              읽는 값이지 고치는 값이 아니므로 입력칸 모양을 빌리되 잠가 둔다. */}
          <div className="account-identity">
            <span className="account-identity-label">내 계정</span>
            {/* 카카오는 이메일이 선택 동의라 주지 않을 수 있다. 그때 "확인하지
                못했어요"라고 쓰면 정상인 상태를 고장으로 읽게 만든다. 연결된
                제공자를 알고 있으면 그 사실을 그대로 말한다. */}
            <p className="account-identity-value">
              {account.email ??
                (account.provider
                  ? "이메일은 받지 않았어요"
                  : "연결된 계정을 확인하지 못했어요")}
            </p>
            {providerLabel(account.provider) && (
              <span className="account-identity-provider">
                {providerLabel(account.provider)}로 연결됨
              </span>
            )}
          </div>
          <NicknameForm initial={nickname} />
          {/* 돌아가는 길은 패널 위의 링크 하나뿐이다. 여기 있던 버튼은 그 링크와
              같은 일을 하면서 계정 삭제 바로 위에 앉아 있었다. */}
          <form action="/api/auth/signout" method="post">
            <button className="signout-button" type="submit">
              이 기기에서 로그아웃
            </button>
          </form>
          <AccountDeletion />
        </>
      )}
    </section>
  );
}
