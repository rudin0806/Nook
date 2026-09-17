"use client";
import { useState } from "react";
import Link from "next/link";

type Key = "age" | "terms" | "privacy";
const items: { key: Key; label: string; href?: string; linkText?: string }[] = [
  { key: "age", label: "만 14세 이상입니다." },
  {
    key: "terms",
    label: "에 동의합니다.",
    href: "/terms",
    linkText: "이용약관",
  },
  {
    key: "privacy",
    label: "에 따른 개인정보 수집·이용에 동의합니다.",
    href: "/privacy",
    linkText: "개인정보처리방침",
  },
];

/** 개인정보 보호법 제22조 asks for each item to be agreed to separately, so there
 * is no single pre-ticked box. The all-at-once control only sets the three; it is
 * not itself the consent. The server re-checks the submitted field.
 */
export function ConsentGate({ returnTo }: { returnTo: string }) {
  const [checked, setChecked] = useState<Record<Key, boolean>>({
    age: false,
    terms: false,
    privacy: false,
  });
  const all = items.every((item) => checked[item.key]);
  return (
    <form action="/api/auth/start" method="post" className="consent-gate">
      <input type="hidden" name="provider" value="google" />
      <input type="hidden" name="returnTo" value={returnTo} />
      <input type="hidden" name="agreed" value={all ? "on" : ""} />
      <fieldset className="consent-list">
        <legend>시작하기 전에</legend>
        <label className="consent-all">
          <input
            type="checkbox"
            checked={all}
            onChange={(event) =>
              setChecked({
                age: event.target.checked,
                terms: event.target.checked,
                privacy: event.target.checked,
              })
            }
          />
          <span>아래 항목에 모두 동의합니다.</span>
        </label>
        {items.map((item) => (
          <label className="consent-item" key={item.key}>
            <input
              type="checkbox"
              checked={checked[item.key]}
              onChange={(event) =>
                setChecked((current) => ({
                  ...current,
                  [item.key]: event.target.checked,
                }))
              }
            />
            <span>
              <em>[필수]</em>{" "}
              {item.href ? (
                <>
                  <Link href={item.href}>{item.linkText}</Link>
                  {item.label}
                </>
              ) : (
                item.label
              )}
            </span>
          </label>
        ))}
      </fieldset>
      <button className="google-button" type="submit" disabled={!all}>
        <span aria-hidden="true">G</span>Google로 계속하기
        <span aria-hidden="true">↗</span>
      </button>
      <p className="account-caption">가입과 로그인을 한 번에.</p>
      <p className="account-legal">
        적어둔 생각의 원문은 질문을 만들기 위해 국외의 AI 처리자에게 전송돼요.
        어떤 정보가 어디로 가는지는{" "}
        <Link href="/privacy">개인정보처리방침</Link> 5항에 있어요.
      </p>
    </form>
  );
}
