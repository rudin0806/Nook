"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ActionButton } from "@seed-design/react";
export function AccountPanel({ message }: { message: string | null }) {
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
        if (!controller.signal.aborted) setState(body.state);
      })
      .catch(() => {
        if (!controller.signal.aborted) setState("unavailable");
      });
    return () => controller.abort();
  }, [attempt]);
  return (
    <section className="account-panel" aria-busy={state === "loading"}>
      <span className="account-mark" aria-hidden="true">
        n.
      </span>
      <p className="section-index">MY LITTLE NOOK</p>
      <h1>
        {state === "signed_in"
          ? "다시 만나 반가워요."
          : "내 생각을, 내 자리에."}
      </h1>
      <p className="account-description">
        {state === "signed_in"
          ? "남겨둔 질문들이 여기 있어요."
          : "보관한 생각을 다시 펼쳐보는 계정."}
      </p>
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
        <>
          <form action="/api/auth/start" method="post">
            <input type="hidden" name="provider" value="google" />
            <button className="google-button" type="submit">
              <span aria-hidden="true">G</span>Google로 계속하기
              <span aria-hidden="true">↗</span>
            </button>
          </form>
          <p className="account-caption">가입과 로그인을 한 번에.</p>
        </>
      ) : (
        <>
          <Link className="account-primary" href="/drawer">
            내 생각 더미 열기 ↗
          </Link>
          <form action="/api/auth/signout" method="post">
            <button className="signout-button" type="submit">
              이 기기에서 로그아웃
            </button>
          </form>
        </>
      )}
      <Link className="account-back" href="/">
        ← 생각 쓰기로 돌아가기
      </Link>
    </section>
  );
}
