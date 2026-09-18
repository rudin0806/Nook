"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ActionButton } from "@seed-design/react";
import { z } from "zod";
import { loginPath } from "@/lib/auth/return-path";
import { readRetentionDraft, retentionDraftKey } from "@/lib/retention/draft";
export function ConversationRetention({
  sessionId,
  branches,
  onCancel,
  onDone,
  closure = false,
}: {
  sessionId: string;
  branches: { id: string; text: string }[];
  onCancel?: () => void;
  onDone?: () => void;
  closure?: boolean;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [notice, setNotice] = useState("");
  const [login, setLogin] = useState(false);
  const lock = useRef(false);
  const [draftReady, setDraftReady] = useState(false);
  const branchIds = branches.map((branch) => branch.id).join(",");
  useEffect(() => {
    const allowedIds = new Set(branchIds.split(","));
    const controller = new AbortController();
    void fetch("/api/auth/status", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => response.json())
      .then((body) => {
        if (controller.signal.aborted) return;
        const raw = sessionStorage.getItem(retentionDraftKey(sessionId));
        const draft = readRetentionDraft(raw, body.userId, sessionId);
        if (draft) {
          setSelected(draft.selected.filter((id) => allowedIds.has(id)));
          setNotice(
            "선택한 질문을 불러왔어요. 보관 내용을 확인한 뒤 남겨 주세요.",
          );
        } else if (raw) {
          sessionStorage.removeItem(retentionDraftKey(sessionId));
          setNotice(
            "이전 선택이 만료됐거나 계정이 달라졌어요. 보관할 질문을 다시 골라 주세요.",
          );
        }
      })
      .catch(() => {
        /* Storage unavailable: manual selection remains usable. */
      })
      .finally(() => {
        if (!controller.signal.aborted) setDraftReady(true);
      });
    return () => controller.abort();
  }, [sessionId, branchIds]);
  async function connectAccount() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const response = await fetch("/api/auth/status", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok || !z.uuid().safeParse(body.userId).success) {
        throw new Error();
      }
      sessionStorage.setItem(
        retentionDraftKey(sessionId),
        JSON.stringify({
          userId: body.userId,
          sessionId,
          selected,
          expiresAt: Date.now() + 600_000,
        }),
      );
      window.location.assign(loginPath(`/resume/${sessionId}?retention=1`));
    } catch {
      setNotice(
        "선택을 안전하게 보관하지 못했어요. 브라우저 저장 공간과 로그인 상태를 확인한 뒤 다시 시도해 주세요.",
      );
      lock.current = false;
      setBusy(false);
    }
  }
  async function save(keep: boolean) {
    if (lock.current) return;
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
            : "보관 결과를 확인하지 못했어요. 생각 더미에서 현재 기록을 확인해 주세요.",
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
      try {
        sessionStorage.removeItem(retentionDraftKey(sessionId));
      } catch {}
      setDone(true);
      onDone?.();
    } catch {
      setNotice(
        "처리 결과를 확인하지 못했어요. 생각 더미에서 기록을 확인한 뒤 다시 시도해 주세요.",
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
        <Link href="/drawer">생각 더미 보기</Link> ·{" "}
        <Link href="/">새 생각 시작하기</Link>
      </div>
    );
  return (
    <section aria-label="기록 보관 선택">
      <h2>
        {closure ? "여기까지 남길까요?" : "이 이야기를 생각 더미에 보관할까요?"}
      </h2>
      {branches.length > 0 && (
        <fieldset disabled={busy || !draftReady}>
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
        계정이 연결된 기록은 남기지 않으면 휴지통에서 7일간 복원할 수 있어요.
      </p>
      <p>
        이야기와 질문은 각각 선택할 수 있어요. 계정 연결 없이 아무것도 남기지
        않으면 기록을 복원할 수 없어요.
      </p>
      <p>
        이미 보낸 내용과 확인한 질문을 남겨요. 미전송 입력이나 아직 도착하지
        않은 AI 응답은 포함되지 않아요.
      </p>
      <div className="preview-actions">
        <ActionButton
          disabled={busy || !draftReady}
          onClick={() => void save(true)}
        >
          {busy ? "반영하는 중…" : closure ? "남기고 마치기" : "남기고 나가기"}
        </ActionButton>
        {!closure && (
          <ActionButton
            disabled={busy || !draftReady}
            variant="ghost"
            onClick={() => void save(false)}
          >
            남기지 않고 나가기
          </ActionButton>
        )}
        {onCancel && (
          <ActionButton
            disabled={busy || !draftReady}
            variant="ghost"
            onClick={onCancel}
          >
            대화로 돌아가기
          </ActionButton>
        )}
      </div>
      <p role="status">{notice}</p>
      {login && (
        <ActionButton
          disabled={busy || !draftReady}
          onClick={() => void connectAccount()}
        >
          계정 연결하고 보관 선택으로 돌아오기
        </ActionButton>
      )}
    </section>
  );
}
