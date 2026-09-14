"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { ActionButton } from "@seed-design/react";
import { z } from "zod";
export function ConversationRetention({
  sessionId,
  branches,
}: {
  sessionId: string;
  branches: { id: string; text: string }[];
}) {
  const [keep, setKeep] = useState<boolean | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [notice, setNotice] = useState("");
  const [login, setLogin] = useState(false);
  const lock = useRef(false);
  async function save() {
    if (lock.current || keep === null) return;
    lock.current = true;
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch(`/api/sessions/${sessionId}/retention`, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ keepSession: keep, keptBranchIds: selected }),
      });
      if (!response.ok) {
        const raw = await response.json();
        const code = z
          .object({ error: z.object({ code: z.string() }) })
          .parse(raw).error.code;
        setLogin(code === "IDENTITY_LINK_REQUIRED" || response.status === 401);
        setNotice(
          code === "IDENTITY_LINK_REQUIRED"
            ? "남겨두려면 먼저 계정을 연결해 주세요. 계정 연결 후 이 이야기로 돌아와 보관을 선택할 수 있어요."
            : "보관 결과를 확인하지 못했어요. 생각더미에서 현재 기록을 확인해 주세요.",
        );
        return;
      }
      z.object({
        data: z.object({
          sessionId: z.literal(sessionId),
          state: z.enum(["saved", "trashed", "deleted"]),
          keptBranchCount: z.number().int().nonnegative(),
        }),
      }).parse(await response.json());
      setDone(true);
    } catch {
      setNotice(
        "처리 결과를 확인하지 못했어요. 생각더미에서 기록을 확인한 뒤 다시 시도해 주세요.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  if (done)
    return (
      <div role="status">
        <p>선택한 보관 내용을 반영했어요.</p>
        <Link href="/drawer">생각더미 보기</Link> ·{" "}
        <Link href="/">새 생각 시작하기</Link>
      </div>
    );
  return (
    <section aria-label="기록 보관 선택">
      <h2>어떤 내용을 남길까요?</h2>
      <fieldset disabled={busy}>
        <legend>이 이야기의 질문 경로</legend>
        <label>
          <input
            type="radio"
            name="keep-story"
            checked={keep === true}
            onChange={() => setKeep(true)}
          />{" "}
          기록 남기기
        </label>
        <label>
          <input
            type="radio"
            name="keep-story"
            checked={keep === false}
            onChange={() => setKeep(false)}
          />{" "}
          남기지 않기
        </label>
      </fieldset>
      {branches.length > 0 && (
        <fieldset disabled={busy}>
          <legend>나중에 다시 볼 질문</legend>
          {branches.map((b) => (
            <label key={b.id}>
              <input
                type="checkbox"
                checked={selected.includes(b.id)}
                onChange={(e) =>
                  setSelected((v) =>
                    e.target.checked
                      ? [...v, b.id]
                      : v.filter((id) => id !== b.id),
                  )
                }
              />
              {b.text}
            </label>
          ))}
        </fieldset>
      )}
      <p>
        이야기와 질문은 각각 선택할 수 있어요. 계정 연결 없이 아무것도 남기지
        않으면 기록을 복원할 수 없어요.
      </p>
      <ActionButton
        disabled={busy || keep === null}
        onClick={() => void save()}
      >
        {busy ? "반영하는 중…" : "선택한 내용으로 마치기"}
      </ActionButton>
      <p role="status">{notice}</p>
      {login && (
        <Link href="/login" target="_blank" rel="noopener noreferrer">
          새 창에서 계정 연결하기
        </Link>
      )}
    </section>
  );
}
