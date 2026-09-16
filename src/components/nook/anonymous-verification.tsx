"use client";
import { useEffect, useRef, useState } from "react";
import Script from "next/script";

type Turnstile = {
  render(
    element: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => boolean;
      theme: string;
      size: string;
    },
  ): string;
  remove(id: string): void;
};
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

/** Supabase verifies the token. Client presence alone never grants a session. */
export function AnonymousVerification({
  onToken,
}: {
  onToken: (token: string) => void;
}) {
  const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const [needed, setNeeded] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const element = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!sitekey) return;
    const controller = new AbortController();
    void fetch("/api/auth/status", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => response.json())
      .then((body) => {
        if (!controller.signal.aborted)
          setNeeded(body.userId === null && body.anonymousEnabled === true);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [sitekey]);
  useEffect(() => {
    const api = window.turnstile;
    if (!needed || !ready || !sitekey || !element.current || !api) return;
    const id = api.render(element.current, {
      sitekey,
      theme: "auto",
      size: "flexible",
      callback: (token) => {
        onToken(token);
        setError(false);
      },
      "expired-callback": () => onToken(""),
      "error-callback": () => {
        onToken("");
        setError(true);
        return true;
      },
    });
    return () => {
      api.remove(id);
      onToken("");
    };
  }, [needed, ready, sitekey, onToken]);
  if (!sitekey || !needed) return null;
  return (
    <div className="anonymous-verification">
      <p>계정 없이 시작하기 위한 사용자 확인</p>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        onReady={() => setReady(true)}
        onError={() => setError(true)}
      />
      <div ref={element} />
      {error && (
        <p role="status">
          사용자 확인을 불러오지 못했어요. 새로고침하거나 계정을 연결해 주세요.
        </p>
      )}
    </div>
  );
}
