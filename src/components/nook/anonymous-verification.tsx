"use client";
import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import type { CaptchaGateState } from "@/lib/auth/captcha-gate";

type CaptchaApi = {
  render(
    element: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => boolean;
      theme: string;
      size?: string;
    },
  ): string;
  remove?(id: string): void;
  reset?(id: string): void;
};
declare global {
  interface Window {
    turnstile?: CaptchaApi;
    hcaptcha?: CaptchaApi;
  }
}

/** Supabase verifies the token, so the provider rendered here must be the one
 * configured in Supabase Auth: a token from the other provider is rejected.
 * hCaptcha wins when both keys are present, because that is the explicit choice.
 */
const hcaptchaKey = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY;
const turnstileKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const provider = hcaptchaKey ? "hcaptcha" : turnstileKey ? "turnstile" : null;
const sitekey = hcaptchaKey || turnstileKey;
const scriptSrc =
  provider === "hcaptcha"
    ? "https://js.hcaptcha.com/1/api.js?render=explicit"
    : "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/** Client presence alone never grants a session. */
export function AnonymousVerification({
  onToken,
  onStateChange,
}: {
  onToken: (token: string) => void;
  onStateChange: (state: CaptchaGateState) => void;
}) {
  const [needed, setNeeded] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [solved, setSolved] = useState(false);
  const element = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    onStateChange("checking");
    void fetch("/api/auth/status", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => response.json())
      .then((body) => {
        if (controller.signal.aborted) return;
        const required = body.userId === null && body.anonymousEnabled === true;
        setNeeded(required);
        onStateChange(
          required ? (sitekey ? "required" : "unavailable") : "not-required",
        );
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setError(true);
        onStateChange("unavailable");
      });
    return () => controller.abort();
  }, [onStateChange]);
  useEffect(() => {
    const api = provider === "hcaptcha" ? window.hcaptcha : window.turnstile;
    if (!needed || !ready || !sitekey || !element.current || !api) return;
    const id = api.render(element.current, {
      sitekey,
      theme: "auto",
      // Turnstile accepts a flexible width; hCaptcha does not know that value.
      ...(provider === "turnstile" ? { size: "flexible" } : {}),
      callback: (token) => {
        onToken(token);
        setError(false);
        setSolved(true);
      },
      // A token expires, and then the box has to come back.
      "expired-callback": () => {
        onToken("");
        setSolved(false);
      },
      "error-callback": () => {
        onToken("");
        setError(true);
        setSolved(false);
        return true;
      },
    });
    return () => {
      try {
        api.remove?.(id);
      } catch {
        api.reset?.(id);
      }
      onToken("");
    };
  }, [needed, ready, onToken]);
  if (!needed) return null;
  if (!sitekey)
    return (
      <div className="anonymous-verification">
        <p role="status">
          사용자 확인 설정을 불러오지 못했어요. 잠시 뒤 다시 시도하거나 계정을
          연결해 주세요.
        </p>
      </div>
    );
  return (
    <div className="anonymous-verification" data-solved={solved || undefined}>
      <p>{solved ? "확인됐어요" : "계정 없이 시작하기 위한 사용자 확인"}</p>
      <Script
        src={scriptSrc}
        onReady={() => setReady(true)}
        onError={() => setError(true)}
      />
      <div className="anonymous-verification-box" ref={element} />
      {error && (
        <p role="status">
          사용자 확인을 불러오지 못했어요. 새로고침하거나 계정을 연결해 주세요.
        </p>
      )}
    </div>
  );
}
