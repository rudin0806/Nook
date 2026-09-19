"use client";
import { useEffect, useState } from "react";
import { ActionButton } from "@seed-design/react";
import { PageHeading } from "./page-heading";
import { NicknameForm } from "./nickname-form";
import { AccountDeletion } from "./account-deletion";
import { ConsentGate } from "./consent-gate";
import { readNickname } from "@/schemas/profile";
export function AccountPanel({
  message,
  returnTo = "/drawer",
}: {
  message: string | null;
  returnTo?: string;
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
          state === "signed_in" ? "다시 만나 반가워요" : "내 생각을, 내 자리에"
        }
        subtitle={
          state === "signed_in"
            ? "남겨둔 질문들이 여기 있어요"
            : "보관한 생각을 다시 펼쳐보는 계정"
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
        <ConsentGate returnTo={returnTo} />
      ) : (
        <>
          {/* 어느 계정으로 들어와 있는지가 이 화면에서 가장 먼저 답해야 할 질문이다.
              읽는 값이지 고치는 값이 아니므로 입력칸 모양을 빌리되 잠가 둔다. */}
          <div className="account-identity">
            <span className="account-identity-label">내 계정</span>
            <p className="account-identity-value">
              {account.email ?? "연결된 계정을 확인하지 못했어요"}
            </p>
            {account.provider && (
              <span className="account-identity-provider">
                {account.provider === "google"
                  ? "Google로 연결됨"
                  : `${account.provider}로 연결됨`}
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
