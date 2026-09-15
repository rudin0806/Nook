"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ActionButton, TextField } from "@seed-design/react";
import { ConversationRetention } from "./conversation-retention";
import type { StartView } from "@/lib/start/client";
import { RecoveryList } from "./recovery-list";
import { useStartConversation } from "./use-start-conversation";

export function ThoughtInput({
  enabled = false,
  initialThought = "",
  initialView,
  initialSessionId,
  source,
  showRecovery = false,
}: {
  enabled?: boolean;
  initialThought?: string;
  initialView?: StartView;
  initialSessionId?: string;
  source?: { kind: "node" | "branch" | "session"; id: string };
  showRecovery?: boolean;
}) {
  const [exiting, setExiting] = useState(false);
  const [thought, setThought] = useState(initialThought);
  const [editedQuestion, setEditedQuestion] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const flow = useStartConversation(initialView, initialSessionId);
  const { view, locked } = flow;
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (view.kind !== "input") heading.current?.focus();
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
      aria-label="내 생각 쓰기"
      aria-busy={flow.busy}
      onKeyDown={(e) => {
        if (e.key === "Escape") setExpanded(false);
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
          {expanded ? "접어두기 ↙" : "넓게 쓰기 ↗"}
        </ActionButton>
      </div>
      <h1 ref={heading} tabIndex={-1}>
        {view.kind === "input"
          ? "지금, 어떤 생각이 드나요?"
          : view.kind === "proposal"
            ? "이 질문으로 시작할까요?"
            : view.kind === "focus"
              ? "무엇부터 볼까요?"
              : view.kind === "approved"
                ? "첫 질문을 기록했어요."
                : "잠시 살펴봐요."}
      </h1>
      {view.kind === "input" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (enabled && thought.trim() && !locked)
              flow.submit("start", { thought, ...(source ? { source } : {}) });
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
          <div className="paper-bottom">
            <p id="writing-availability">
              {enabled
                ? "첫 질문은 확인한 뒤 기록해요."
                : "대화 연결 준비 중이에요. 입력은 전송·저장되지 않아요."}
            </p>
            <ActionButton
              type="submit"
              variant="neutralWeak"
              disabled={!enabled || !thought.trim() || locked}
            >
              {flow.busy ? "살펴보는 중…" : "시작하기 ↗"}
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
        <form
          className="start-response"
          onSubmit={(e) => {
            e.preventDefault();
            if (finalText.trim() && !locked)
              flow.submit("approve", { receipt: view.receipt, finalText });
          }}
        >
          {view.evidence && <p>{view.evidence}</p>}
          <TextField.Root className="writing-field">
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
          <p>내 뜻과 맞게 수정할 수 있어요. 아직 확정된 기록은 아니에요.</p>
          <ActionButton
            type="submit"
            variant="neutralWeak"
            disabled={locked || !finalText.trim()}
          >
            {flow.busy ? "확인하는 중…" : "이 질문으로 확정하기"}
          </ActionButton>
        </form>
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
          <p>
            확인한 질문이 기록됐어요. 지금 떠오르는 이야기를 이어갈 수 있어요.
          </p>
          <Link href={`/talk/${view.nodeId}`} className="editorial-link">
            이 질문으로 이야기 이어가기 ↗
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
