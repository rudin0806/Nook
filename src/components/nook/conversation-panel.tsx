"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ActionButton, TextField } from "@seed-design/react";
import {
  makeConversationRequest,
  readConversation,
  sendConversation,
} from "@/lib/conversation/client";
import type {
  ConversationRequest,
  ConversationView,
} from "@/schemas/conversation";
import { SessionOrigin } from "./session-origin";
import { ConversationRetention } from "./conversation-retention";
export function ConversationPanel({ nodeId }: { nodeId: string }) {
  const [exitMode, setExitMode] = useState<"exit" | "closure" | null>(null);
  const ended = useRef(false);
  const exitOpen = useRef(false);
  function openExit(mode: "exit" | "closure") {
    exitOpen.current = true;
    setExitMode(mode);
  }
  const [view, setView] = useState<ConversationView | null>(null);
  const [text, setText] = useState("");
  const [edit, setEdit] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [login, setLogin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(false);
  const [wait, setWait] = useState(0);
  const pending = useRef<string | null>(null);
  const lock = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    const c = new AbortController();
    void readConversation(nodeId, c.signal)
      .then((v) => {
        if (!c.signal.aborted) setView(v);
      })
      .catch((e) => {
        if (c.signal.aborted) return;
        setLogin(e.message === "LOGIN_REQUIRED");
        setNotice(
          e.message === "NOT_ENABLED"
            ? "이어지는 대화 연결을 준비하고 있어요."
            : "이야기를 불러오지 못했어요. 로그인 상태를 확인하고 다시 열어 주세요.",
        );
      });
    return () => {
      alive.current = false;
      c.abort();
    };
  }, [nodeId]);
  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((v) => Math.max(0, v - 1)), 1000);
    return () => clearTimeout(timer);
  }, [wait]);
  async function refresh() {
    try {
      const v = await readConversation(nodeId);
      if (alive.current && !ended.current && !exitOpen.current) {
        setView((current) =>
          current && current.version > v.version ? current : v,
        );
        setNotice("");
        setLogin(false);
      }
    } catch {
      if (alive.current && !ended.current && !exitOpen.current) {
        setView(null);
        setNotice("현재 기록을 불러오지 못했어요. 잠시 후 다시 확인해 주세요.");
      }
    }
  }
  async function execute(body: string) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setNotice("");
    try {
      const result = await sendConversation(body);
      if (!alive.current || ended.current) return;
      if (result.kind === "done") {
        pending.current = null;
        setRetry(false);
        setText("");
        setEdit(null);
        if (result.safety) {
          setView((v) =>
            v
              ? {
                  ...v,
                  version: result.result.version,
                  mode: result.safety!.behavior as "STOP" | "HANDOFF",
                  messages: [],
                  pending: null,
                  clarifications: [],
                  branches: [],
                  contact: result.safety!.contact,
                }
              : v,
          );
        } else await refresh();
      } else if (result.kind === "wait") {
        setRetry(true);
        setWait(result.seconds);
        setNotice(
          "처리 중이거나 잠시 기다려야 해요. 같은 요청으로 결과를 다시 확인할 수 있어요.",
        );
      } else {
        pending.current = null;
        setRetry(false);
        await refresh();
        if (!alive.current || ended.current) return;
        setLogin(result.kind === "login");
        setNotice(
          "요청을 완료하지 못했어요. 현재 기록을 확인한 뒤 다시 입력해 주세요.",
        );
      }
    } catch {
      if (alive.current && !ended.current) {
        setRetry(true);
        setNotice(
          "처리 결과를 확인하지 못했어요. 다시 입력하지 말고 같은 요청의 결과를 확인해 주세요.",
        );
      }
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  function act(action: ConversationRequest["action"], value?: string) {
    if (!view || lock.current || pending.current) return;
    const body = makeConversationRequest({
      nodeId,
      version: view.version,
      action,
      ...(value ? { text: value } : {}),
    });
    pending.current = body;
    void execute(body);
  }
  const locked = busy || retry;
  const stopped = view?.mode === "STOP" || view?.mode === "HANDOFF";
  return (
    <section aria-label="이야기 나누기" aria-busy={busy}>
      {view && !stopped && (
        <>
          <p className="preview-kicker">지금 함께 보는 질문</p>
          <h1>{view.currentQuestion}</h1>
          <SessionOrigin sessionId={view.sessionId} />
          {view.branches.length > 0 &&
            !exitMode &&
            view.mode !== "FINISHED" && (
              <aside aria-label="다른 생각으로 이어지는 질문">
                <ul>
                  {view.branches.map((b) => (
                    <li key={b.id}>
                      <Link href={`/restart/branch/${b.id}`}>{b.text}</Link>
                    </li>
                  ))}
                </ul>
              </aside>
            )}
          {exitMode && (
            <ConversationRetention
              sessionId={view.sessionId}
              branches={view.branches}
              closure={exitMode === "closure"}
              onCancel={() => {
                exitOpen.current = false;
                setExitMode(null);
                void refresh();
              }}
              onDone={() => {
                ended.current = true;
                setBusy(false);
                setNotice("");
                setRetry(false);
              }}
            />
          )}
          <ol className="drawer-list" aria-label="최근 대화">
            {view.messages.map((m) => (
              <li key={m.id} className="preview-summary-card">
                <small>{m.role === "USER" ? "내 이야기" : "누크의 질문"}</small>
                <p className="conversation-message">{m.content}</p>
              </li>
            ))}
          </ol>
          {view.clarifications.length > 0 && (
            <aside aria-label="분명해진 것">
              <h2>분명해진 것</h2>
              <ul>
                {view.clarifications.map((c) => (
                  <li key={c.id}>{c.text}</li>
                ))}
              </ul>
            </aside>
          )}
          {!exitMode && view.mode === "READY" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (text.trim()) act("reply", text.trim());
              }}
            >
              <TextField.Root className="writing-field">
                <TextField.Textarea
                  aria-label="이어서 이야기하기"
                  className="writing-textarea"
                  maxLength={1000}
                  value={text}
                  readOnly={locked}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="지금 떠오르는 이야기를 적어 주세요."
                />
              </TextField.Root>
              <ActionButton type="submit" disabled={locked || !text.trim()}>
                이어서 보내기
              </ActionButton>
            </form>
          )}
          {!exitMode && view.mode === "SHIFT" && view.pending && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                act("approve", (edit ?? view.pending!.question).trim());
              }}
            >
              <h2>이 질문으로 옮겨볼까요?</h2>
              <p>{view.pending.evidence_sentence}</p>
              <TextField.Root className="writing-field">
                <TextField.Textarea
                  aria-label="이동할 질문 수정"
                  className="writing-textarea"
                  maxLength={1000}
                  value={edit ?? view.pending.question}
                  readOnly={locked}
                  onChange={(e) => setEdit(e.target.value)}
                />
              </TextField.Root>
              <p>내 뜻에 맞게 수정한 뒤 확인해 주세요.</p>
              <div className="preview-actions">
                <ActionButton
                  type="submit"
                  disabled={locked || !(edit ?? view.pending.question).trim()}
                >
                  이 질문으로 이동
                </ActionButton>
                <ActionButton
                  type="button"
                  variant="ghost"
                  disabled={locked}
                  onClick={() => act("reject")}
                >
                  지금 질문 유지
                </ActionButton>
              </div>
            </form>
          )}
          {!exitMode &&
            (view.mode === "CLOSE" || view.mode === "STRUCTURAL") && (
              <div>
                <h2>여기까지 정리해 볼까요?</h2>
                <p>
                  {view.mode === "STRUCTURAL"
                    ? "지나온 질문을 남기거나, 지금 질문에서 이야기를 이어갈 수 있어요."
                    : "여기까지 남겨도 좋고, 더 떠오르는 이야기를 이어가도 좋아요."}
                </p>
                <ActionButton onClick={() => openExit("closure")}>
                  남기고 마치기
                </ActionButton>
                <ActionButton disabled={locked} onClick={() => act("continue")}>
                  더 생각하기
                </ActionButton>
              </div>
            )}
          {!exitMode && view.mode !== "FINISHED" && (
            <ActionButton variant="ghost" onClick={() => openExit("exit")}>
              나가기
            </ActionButton>
          )}
          {!exitMode && view.mode === "FINISHED" && (
            <ConversationRetention
              sessionId={view.sessionId}
              branches={view.branches}
            />
          )}
        </>
      )}
      {stopped && (
        <div role="status">
          <h1>잠시 대화를 멈출게요.</h1>
          <p>
            {view.mode === "STOP"
              ? "지금은 도움을 받을 수 있는 곳과 연결하는 일이 먼저일 수 있어요."
              : "이 주제는 도움을 받을 수 있는 곳을 안내하고 대화를 마칠게요."}
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
          <Link href="/">새 생각 시작하기</Link>
        </div>
      )}
      <div role="status" aria-live="polite">
        {busy && <p>이야기를 살펴보고 있어요…</p>}
        {notice && <p>{notice}</p>}
      </div>
      {login && (
        <p>
          <Link href="/login">계정 연결하기</Link>
        </p>
      )}
      {retry && !exitMode && (
        <ActionButton
          disabled={busy || wait > 0}
          onClick={() => {
            if (pending.current) void execute(pending.current);
          }}
        >
          {wait > 0 ? `${wait}초 뒤 확인` : "같은 요청의 결과 확인"}
        </ActionButton>
      )}
      {!stopped && !locked && !exitMode && (
        <ActionButton variant="ghost" onClick={() => void refresh()}>
          현재 기록 다시 확인
        </ActionButton>
      )}
    </section>
  );
}
