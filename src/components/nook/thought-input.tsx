"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ActionButton, TextField } from "@seed-design/react";
import { ConversationRetention } from "./conversation-retention";
import type { StartView } from "@/lib/start/client";
import { RecoveryList } from "./recovery-list";
import { useStartConversation } from "./use-start-conversation";
import { AnonymousVerification } from "./anonymous-verification";
import { NookIcon } from "./nook-icon";

export function ThoughtInput({
  enabled = false,
  preview = false,
  initialThought = "",
  initialView,
  initialSessionId,
  source,
  showRecovery = false,
  expanded: controlledExpanded,
  onExpandedChange,
}: {
  enabled?: boolean;
  /** 잠긴 이유가 준비 중이 아니라 미리보기일 때. 안내 문구만 달라진다. */
  preview?: boolean;
  initialThought?: string;
  initialView?: StartView;
  initialSessionId?: string;
  source?: { kind: "node" | "branch" | "session"; id: string };
  showRecovery?: boolean;
  /** The home desk owns this, because widening the panel is a change to the
   * page grid rather than to the panel. Left out elsewhere, where the panel is
   * already the whole column and manages the state itself. */
  expanded?: boolean;
  onExpandedChange?: (next: boolean) => void;
}) {
  const [captchaToken, setCaptchaToken] = useState("");
  const [verificationAttempt, setVerificationAttempt] = useState(0);
  const [exiting, setExiting] = useState(false);
  const [thought, setThought] = useState(initialThought);
  const [editedQuestion, setEditedQuestion] = useState<string | null>(null);
  const [ownExpanded, setOwnExpanded] = useState(false);
  const expanded = controlledExpanded ?? ownExpanded;
  const setExpanded = onExpandedChange ?? setOwnExpanded;
  const flow = useStartConversation(initialView, initialSessionId);
  const { view, locked } = flow;
  const router = useRouter();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (view.kind !== "input") heading.current?.focus();
  }, [view.kind]);
  /** 질문을 확정하면 대화로 간다. 사이에 "기록했어요 → 이어가기" 한 화면이 있었는데,
   *  사용자가 방금 확정을 눌러 뜻을 밝힌 자리에서 같은 뜻을 한 번 더 누르게 하는
   *  화면이라 흐름이 끊겼다. push라서 뒤로 가면 홈이다. */
  useEffect(() => {
    if (view.kind === "approved") router.push(`/talk/${view.nodeId}`);
  }, [view, router]);
  /** 제안이 오면 옆 단이 물러난다. 여기서부터는 대화를 여는 일이 화면의 유일한
   *  일이고, 확정하면 같은 틀 그대로 대화 화면이 이어진다 — 확정과 대화 사이에서
   *  화면이 통째로 바뀌지 않는 편이 무엇을 하고 있는지 잃지 않는다. */
  useEffect(() => {
    if (view.kind === "proposal" || view.kind === "focus") setExpanded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.kind]);
  const waitLabel =
    flow.waitSeconds >= 3600
      ? `약 ${Math.ceil(flow.waitSeconds / 3600)}시간 뒤`
      : flow.waitSeconds >= 60
        ? `약 ${Math.ceil(flow.waitSeconds / 60)}분 뒤`
        : `${flow.waitSeconds}초 뒤`;
  const finalText =
    view.kind === "proposal" ? (editedQuestion ?? view.question) : "";
  function restart() {
    flow.reset();
    setThought("");
    setEditedQuestion(null);
  }
  const sessionId = flow.sessionId;
  if (exiting && sessionId)
    return (
      <ConversationRetention
        sessionId={sessionId}
        branches={[]}
        onCancel={() => setExiting(false)}
      />
    );
  return (
    <section
      className="writing-surface"
      data-expanded={expanded}
      data-stage={view.kind}
      aria-label="내 생각 쓰기"
      aria-busy={flow.busy}
      onKeyDown={(e) => {
        if (e.key === "Escape") setExpanded(false);
      }}
      onFocusCapture={(e) => {
        // Focus reaching the field is the same intent as pressing 넓게 쓰기.
        if (e.target instanceof HTMLTextAreaElement) setExpanded(true);
      }}
    >
      <div className="paper-top">
        <span>지금, 내 머릿속</span>
        <ActionButton
          variant="ghost"
          size="small"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "접어두기" : "넓게 쓰기"}
        </ActionButton>
      </div>
      <div className="panel-title-with-icon">
        <NookIcon name="write" tone="blue" tile />
        <h2 ref={heading} tabIndex={-1}>
          {view.kind === "input"
            ? "생각 적기"
            : view.kind === "proposal"
              ? "이 질문으로 시작할까요?"
              : view.kind === "focus"
                ? "무엇부터 볼까요?"
                : view.kind === "approved"
                  ? "대화를 여는 중이에요"
                  : "잠시 살펴봐요."}
        </h2>
      </div>
      {view.kind === "input" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (enabled && thought.trim() && !locked) {
              flow.submit("start", {
                thought,
                ...(captchaToken ? { captchaToken } : {}),
                ...(source ? { source } : {}),
              });
              setVerificationAttempt((value) => value + 1);
            }
          }}
        >
          <TextField.Root className="writing-field">
            <TextField.Textarea
              id="raw-thought"
              name="rawThought"
              className="writing-textarea"
              aria-label="생각 적기"
              aria-describedby="writing-availability"
              placeholder="오늘 자꾸 떠오르는 건…"
              value={thought}
              onChange={(e) => setThought(e.target.value)}
              maxLength={5000}
              readOnly={locked}
              autoComplete="off"
            />
          </TextField.Root>
          {/* Not before the first keystroke. A visitor who has written nothing
              was being shown a CAPTCHA under an empty box, which is the
              opposite of "적기 전에 정리하지 않아도 된다". It mounts as soon as
              they start typing, so it has the whole time they are writing to
              load and solve. The server contract is unchanged: Supabase still
              verifies the token, and a submit without one still fails. */}
          {enabled && thought.length > 0 && (
            <AnonymousVerification
              key={verificationAttempt}
              onToken={setCaptchaToken}
            />
          )}
          <div className="paper-bottom">
            <p id="writing-availability">
              {enabled
                ? "첫 질문은 확인한 뒤 기록해요."
                : preview
                  ? "미리보기에서는 새 대화를 시작할 수 없어요. 끄면 바로 쓸 수 있어요."
                  : "대화 연결 준비 중이에요. 입력은 전송·저장되지 않아요."}
            </p>
            <ActionButton
              type="submit"
              variant="neutralSolid"
              disabled={!enabled || !thought.trim() || locked}
            >
              {flow.busy ? "살펴보는 중…" : "시작하기 ›"}
            </ActionButton>
          </div>
        </form>
      )}
      {showRecovery && view.kind === "input" && <RecoveryList />}
      {view.kind === "focus" && (
        <div className="start-response">
          <p>{view.question}</p>
          <div className="start-actions">
            {view.candidates.map((candidate, index) => (
              <ActionButton
                key={index}
                variant="neutralWeak"
                disabled={locked}
                onClick={() =>
                  flow.submit("focus", { receipt: view.receipt, index })
                }
              >
                {candidate}
              </ActionButton>
            ))}
          </div>
        </div>
      )}
      {view.kind === "proposal" && (
        /* 대화 화면과 같은 두 단이다. 왼쪽에서 질문을 고르고, 오른쪽 지도에 그 질문이
           첫 칸으로 미리 서 있다. 확정을 누르면 같은 자리에서 대화가 이어진다. */
        <div className="conversation-layout proposal-layout">
          <form
            className="start-response conversation-stream"
            onSubmit={(e) => {
              e.preventDefault();
              if (finalText.trim() && !locked)
                flow.submit("approve", { receipt: view.receipt, finalText });
            }}
          >
            {view.evidence && (
              <p className="proposal-evidence">{view.evidence}</p>
            )}
            <TextField.Root className="writing-field question-field">
              <TextField.Textarea
                aria-label="첫 질문 수정"
                className="writing-textarea"
                value={finalText}
                onChange={(e) => setEditedQuestion(e.target.value)}
                maxLength={1000}
                readOnly={locked}
                autoComplete="off"
              />
            </TextField.Root>
            <p>고치고 싶으면 그대로 고쳐도 돼요.</p>
            <ActionButton
              type="submit"
              variant="neutralSolid"
              disabled={locked || !finalText.trim()}
            >
              {flow.busy ? "확인하는 중…" : "이 질문으로 확정하기"}
            </ActionButton>
          </form>
          <aside className="conversation-side" aria-label="지나온 질문">
            <nav className="node-navigation">
              <div className="node-navigation-heading">
                <strong>지나온 질문</strong>
                <small>확정하면 여기 첫 칸으로 남아요.</small>
              </div>
              <ol>
                <li>
                  <button type="button" data-pending="true" disabled>
                    <span>1</span>
                    <span>{finalText || view.question}</span>
                  </button>
                </li>
              </ol>
            </nav>
          </aside>
        </div>
      )}
      {view.kind === "info" && (
        <div className="start-response">
          <p>{view.message}</p>
        </div>
      )}
      {view.kind === "replay" && (
        <div className="start-response">
          <p>
            입력은 처리됐어요. 대화를 다시 열어 현재 상태를 확인할 수 있어요.
          </p>
        </div>
      )}
      {view.kind === "replay" && sessionId && (
        <Link href={`/resume/${sessionId}`}>대화 다시 열기</Link>
      )}
      {view.kind === "stopped" && (
        <div className="start-response">
          <p>
            {view.behavior === "STOP"
              ? "지금은 생각을 정리하는 대화보다 도움을 연결하는 일이 먼저일 수 있어요. 여기서 대화를 멈출게요."
              : "이 주제는 도움을 받을 수 있는 곳을 안내하고 여기서 대화를 마칠게요."}
          </p>
          {view.contact && (
            <p>
              도움 안내:{" "}
              <a href={`tel:${view.contact.primary}`}>{view.contact.primary}</a>
              {view.contact.urgent && (
                <>
                  {" "}
                  · 긴급 도움:{" "}
                  <a href={`tel:${view.contact.urgent}`}>
                    {view.contact.urgent}
                  </a>
                </>
              )}
            </p>
          )}
        </div>
      )}
      {view.kind === "approved" && (
        <div className="start-response">
          <p role="status">확인한 질문으로 대화를 열고 있어요.</p>
          {/* 이동이 막힌 브라우저를 위한 대비. 정상 흐름에서는 위 effect가 먼저
              옮겨 가므로 이 줄이 보이는 시간은 한순간이다. */}
          <Link href={`/talk/${view.nodeId}`} className="editorial-link">
            열리지 않으면 여기를 눌러 주세요 ↗
          </Link>
        </div>
      )}
      <div className="start-status" role="status" aria-live="polite">
        {flow.busy && <p>요청을 처리하고 있어요.</p>}
        {flow.notice && <p>{flow.notice.message}</p>}
      </div>
      {flow.notice?.login && (
        <Link href="/login" className="editorial-link">
          Google로 로그인하기 ↗
        </Link>
      )}
      {flow.canRetry && (
        <ActionButton
          variant="neutralWeak"
          disabled={flow.busy || flow.waitSeconds > 0}
          onClick={flow.retry}
        >
          {flow.waitSeconds > 0
            ? `${waitLabel} 확인할 수 있어요`
            : "처리 결과 다시 확인"}
        </ActionButton>
      )}
      {sessionId && view.kind !== "stopped" && (
        <ActionButton variant="ghost" onClick={() => setExiting(true)}>
          나가기
        </ActionButton>
      )}
      {view.kind !== "input" && !locked && (
        <ActionButton className="start-reset" variant="ghost" onClick={restart}>
          다른 생각 적기
        </ActionButton>
      )}
    </section>
  );
}
