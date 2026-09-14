"use client";

import { useState } from "react";
import { ActionButton, TextField } from "@seed-design/react";

type Screen = "start" | "conversation" | "path" | "drawer";
const screens: { id: Screen; label: string }[] = [
  { id: "start", label: "이야기 나누기" },
  { id: "drawer", label: "서랍" },
];
const initialQuestion = "지금 회사를 떠나고 싶은 걸까?";
const nextQuestion = "지금 회사에서 새로운 일을 해볼 수 있을까?";

function ThoughtPath({
  approved,
  question,
}: {
  approved: boolean;
  question: string;
}) {
  return (
    <ol className="preview-path">
      <li>
        <span className="path-dot" />
        <small>시작한 질문</small>
        <h3>{initialQuestion}</h3>
        <p>일 자체가 싫어진 건 아니에요.</p>
      </li>
      {approved && (
        <li>
          <span className="path-dot current" />
          <small>이어진 질문</small>
          <h3>{question}</h3>
          <p>“새로운 일을 해보고 싶은데, 계속 같은 일만 맡아요.”</p>
        </li>
      )}
    </ol>
  );
}

export function NookPreview({
  initialScreen = "start",
}: {
  initialScreen?: Screen;
}) {
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [thought, setThought] = useState("");
  const [approved, setApproved] = useState(initialScreen === "path");
  const [editing, setEditing] = useState(false);
  const [question, setQuestion] = useState(nextQuestion);
  const [notice, setNotice] = useState("");
  function navigate(next: Screen) {
    setScreen(next);
    setNotice("");
  }

  return (
    <div className="nook-preview">
      <div className="preview-ribbon">
        <span>DESIGN PREVIEW</span>예시 데이터로 살펴보는 화면 · 입력은
        전송·저장되지 않아요
      </div>
      <header className="preview-header">
        <button
          className="preview-logo"
          onClick={() => navigate("start")}
          aria-label="이야기 나누기 화면"
        >
          nook<span>.</span>
        </button>
        <nav aria-label="시안 화면 선택">
          {screens.map(({ id, label }) => (
            <button
              key={id}
              aria-current={
                (id === "start" ? screen !== "drawer" : screen === "drawer")
                  ? "page"
                  : undefined
              }
              onClick={() => navigate(id)}
            >
              {label}
            </button>
          ))}
        </nav>
        <span className="preview-edition">A LITTLE ROOM FOR THOUGHT</span>
      </header>
      {screen === "start" ? (
        <main className="preview-start">
          <div className="preview-flower" aria-hidden="true">
            ✳
          </div>
          <p className="preview-kicker">생각이 머무는 작은 자리</p>
          <h1>
            무슨 생각
            <br />
            하고 있었어요?
          </h1>
          <p className="preview-description">
            두서없어도 괜찮아요. 편하게 들려주세요.
          </p>
          <div className="preview-composer">
            <TextField.Root>
              <TextField.Textarea
                aria-label="지금 머릿속에 있는 생각"
                placeholder="어디서부터 말해야 할지 모르겠다면, 그 말부터."
                value={thought}
                onChange={(event) => setThought(event.target.value)}
                maxLength={5000}
              />
            </TextField.Root>
            <div className="preview-composer-bottom">
              <span>{thought.length.toLocaleString()} / 5,000</span>
              <ActionButton
                variant="neutralSolid"
                size="medium"
                onClick={() => navigate("conversation")}
              >
                예시 대화 살펴보기 <span aria-hidden="true">↗</span>
              </ActionButton>
            </div>
          </div>
          <div className="preview-examples">
            <span>이런 생각도 괜찮아요</span>
            {[
              "이직하고 싶은데 이유를 모르겠어",
              "사고 싶은데 계속 망설여져",
              "그냥 머릿속이 복잡해",
            ].map((text) => (
              <ActionButton
                key={text}
                variant="neutralWeak"
                size="xsmall"
                onClick={() => setThought(text)}
              >
                {text}
              </ActionButton>
            ))}
          </div>
          <div className="preview-recent">
            <div>
              <p className="preview-kicker">서랍에 넣어둔 이야기 · 예시</p>
              <h2>
                떠나고 싶은 마음에서,
                <br />
                새로운 일을 해보고 싶은 마음으로.
              </h2>
              <span>9월 14일 · 질문의 경로</span>
            </div>
            <ActionButton
              variant="ghost"
              size="small"
              onClick={() => {
                setApproved(true);
                navigate("path");
              }}
            >
              펼쳐보기 ↗
            </ActionButton>
          </div>
        </main>
      ) : screen === "drawer" ? (
        <main className="preview-summary">
          <div className="drawer-object" aria-hidden="true">
            <span />
          </div>
          <p className="preview-kicker">내가 남겨둔 이야기</p>
          <h1>서랍</h1>
          <p className="preview-description">
            다시 펼쳐보고 싶은 이야기를 여기 모아두어요.
          </p>
          <button
            className="drawer-story"
            onClick={() => {
              setApproved(true);
              setQuestion(nextQuestion);
              navigate("path");
            }}
          >
            <span className="preview-kicker">9월 14일 · 예시 기록</span>
            <h2>새로운 일을 해보고 싶은 마음</h2>
            <p>
              {initialQuestion}
              <br />
              <span aria-hidden="true">↓</span>
              <br />
              {nextQuestion}
            </p>
            <span>이야기 펼쳐보기 ↗</span>
          </button>
          <p className="preview-status">
            보관한 기록이 있을 때의 예시 화면이에요.
          </p>
          <ActionButton variant="ghost" onClick={() => navigate("start")}>
            새 이야기 나누기
          </ActionButton>
        </main>
      ) : screen === "conversation" ? (
        <main className="preview-session">
          <section className="preview-chat" aria-label="예시 대화">
            <div className="preview-section-title">
              <span className="preview-kicker">지금 함께 보고 있는 질문</span>
              <ActionButton
                variant="ghost"
                size="small"
                onClick={() => navigate("path")}
              >
                여기까지 정리하기
              </ActionButton>
            </div>
            <h1>{approved ? question : initialQuestion}</h1>
            <p className="preview-caption">직장에 대한 가상의 대화 예시예요.</p>
            <div className="preview-messages">
              <p className="message-user">
                이직을 해야 하나 싶어요. 그렇다고 일 자체가 싫어진 건 아닌데.
              </p>
              <div className="message-assistant">
                <span className="small-logo">n.</span>
                <p>지금 하는 일에서 바꾸고 싶은 건 어떤 부분이에요?</p>
              </div>
              <p className="message-user">
                새로운 일을 해보고 싶은데, 계속 같은 일만 맡아요. 다른 곳에 가야
                배울 수 있나 싶고요.
              </p>
            </div>
            <section className="preview-proposal" aria-label="새 질문 제안">
              <p className="preview-kicker">이 질문으로 이어가 볼까요?</p>
              {editing ? (
                <TextField.Root>
                  <TextField.Textarea
                    aria-label="제안된 질문 수정"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    maxLength={1000}
                  />
                </TextField.Root>
              ) : (
                <h2>{question}</h2>
              )}
              <p>새로운 일을 해보고 싶지만 계속 같은 일을 맡는다고 말했어요.</p>
              <div className="preview-actions">
                <ActionButton
                  variant="neutralSolid"
                  disabled={!question.trim() || approved}
                  onClick={() => {
                    setApproved(true);
                    setEditing(false);
                    setNotice(
                      "시안에서 질문을 확인했어요. 실제 기록은 저장되지 않아요.",
                    );
                  }}
                >
                  {approved
                    ? "확인한 질문"
                    : editing
                      ? "이 질문으로 보기"
                      : "맞아요"}
                </ActionButton>
                <ActionButton
                  variant="neutralWeak"
                  disabled={approved}
                  onClick={() => setEditing(!editing)}
                >
                  {editing ? "수정 닫기" : "조금 달라요"}
                </ActionButton>
              </div>
            </section>
            <p className="preview-status" role="status">
              {notice || "내가 확인한 질문만 생각의 경로에 남아요."}
            </p>
          </section>
          <aside className="preview-map">
            <p className="preview-kicker">지나온 질문</p>
            <h2>여기서 시작했어요.</h2>
            <ThoughtPath approved={approved} question={question} />
            <p className="preview-map-note">
              질문이 달라진 순간을
              <br />
              차곡차곡 이어두어요.
            </p>
          </aside>
        </main>
      ) : (
        <main className="preview-summary">
          <p className="preview-kicker">서랍에 넣어둔 이야기 · 예시</p>
          <h1>
            오늘 지나온 질문을
            <br />
            펼쳐볼까요?
          </h1>
          <p className="preview-description">
            처음의 질문과, 대화하며 이어진 질문.
          </p>
          <div className="preview-summary-card">
            <ThoughtPath approved={approved} question={question} />
            {approved && question !== nextQuestion && (
              <p>시안에서 수정한 질문: {question}</p>
            )}
          </div>
          <div className="preview-actions">
            <ActionButton
              variant="neutralSolid"
              onClick={() =>
                setNotice(
                  "보관 화면의 시안이에요. 계정 연결 및 실제 저장은 다음 구현 단계예요.",
                )
              }
            >
              이 기록 남기기
            </ActionButton>
            <ActionButton
              variant="ghost"
              onClick={() => {
                setThought("");
                setApproved(false);
                setQuestion(nextQuestion);
                setEditing(false);
                navigate("start");
              }}
            >
              남기지 않고 나가기
            </ActionButton>
          </div>
          <p className="preview-status" role="status">
            {notice || "시안의 예시 데이터는 서버에 저장되지 않아요."}
          </p>
        </main>
      )}
      <footer className="preview-footer">
        <span>답을 주는 대신, 내가 어떤 질문을 지나왔는지.</span>
        <span>Nook × SEED Design</span>
      </footer>
    </div>
  );
}
