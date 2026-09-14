"use client";
import Link from "next/link";
import { useState } from "react";
import { ActionButton, TextField } from "@seed-design/react";

type Screen = "start" | "conversation" | "path" | "drawer";
const first = "지금 회사를 떠나고 싶은 걸까?";
const next = "지금 회사에서 새로운 일을 해볼 수 있을까?";
const books = [
  { date: "08.21", question: "혼자 보내는 주말은 어떨까?" },
  { date: "08.28", question: "다시 그림을 그려볼까?" },
  { date: "09.03", question: "어떤 속도로 일하고 싶을까?" },
  { date: "09.09", question: "서운한 마음을 말해볼까?" },
  { date: "09.12", question: "쉬는 시간을 어떻게 보낼까?" },
  { date: "09.14", question: first },
];
function Path({
  approved,
  question,
  origin = first,
}: {
  approved: boolean;
  question: string;
  origin?: string;
}) {
  return (
    <ol className="thought-path">
      <li className="past">
        <h3>{origin}</h3>
        {origin === first && <p>일 자체가 싫어진 건 아님</p>}
      </li>
      {approved && (
        <li className="confirmed">
          <h3>{question}</h3>
          <p>새로운 일을 해보고 싶다고 말했어요.</p>
        </li>
      )}
      <li className="position">
        <span>지금 여기</span>
      </li>
    </ol>
  );
}
function Shelf({ onOpen }: { onOpen: (index: number) => void }) {
  return (
    <div className="bookshelf" aria-label="예시로 보관한 생각">
      <div className="book-row">
        {books.map((b, i) => (
          <button
            key={b.date}
            className={`book book-${i}`}
            onClick={() => onOpen(i)}
            aria-label={`${b.date} ${b.question} 펼치기`}
          >
            <span className="book-date">{b.date}</span>
            <span className="book-title">{b.question}</span>
            <span className="book-mark" aria-hidden="true">
              n.
            </span>
          </button>
        ))}
        <div className="book-outline" aria-hidden="true" />
      </div>
      <div className="shelf-edge" />
    </div>
  );
}
export function NookPreview({
  initialScreen = "start",
}: {
  initialScreen?: Screen;
}) {
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [thought, setThought] = useState("");
  const [question, setQuestion] = useState(next);
  const [approved, setApproved] = useState(false);
  const [editing, setEditing] = useState(false);
  const [aside, setAside] = useState(false);
  const [cardsOpen, setCardsOpen] = useState(false);
  const [cardSelected, setCardSelected] = useState(false);
  const [cardDeleted, setCardDeleted] = useState(false);
  const [selectedBook, setSelectedBook] = useState(5);
  const [notice, setNotice] = useState("");
  const openBook = (i: number) => {
    setSelectedBook(i);
    setScreen("path");
    setNotice("");
  };
  const begin = () => {
    setApproved(false);
    setAside(false);
    setEditing(false);
    setQuestion(next);
    setScreen("conversation");
    setNotice("");
  };
  const cards = (
    <section className="desk-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">한쪽에 놓아둔</p>
          <h2>남겨둔 질문</h2>
        </div>
        {!cardDeleted && (
          <button
            className="text-button"
            aria-expanded={cardsOpen}
            onClick={() => setCardsOpen(!cardsOpen)}
          >
            {cardsOpen ? "접어두기 −" : "펼쳐보기 +"}
          </button>
        )}
      </div>
      {cardDeleted ? (
        <p className="quiet-empty">지금은 남겨둔 질문이 없어요.</p>
      ) : (
        <div className={cardsOpen ? "question-board" : "card-stack"}>
          <button
            className="question-card"
            onClick={() => {
              setCardsOpen(true);
              setCardSelected(!cardSelected);
            }}
            aria-expanded={cardSelected}
          >
            <span className="eyebrow">09.14 · 이직할까? 에서</span>
            <h3>일 밖에서 새로운 걸 배워볼까?</h3>
            <span className="card-corner" aria-hidden="true">
              ↗
            </span>
          </button>
          {cardsOpen && cardSelected && (
            <div className="preview-actions">
              <ActionButton
                variant="neutralWeak"
                onClick={() =>
                  setNotice(
                    "이 질문으로 시작하는 동작의 시안이에요. 질문은 계속 남아 있어요.",
                  )
                }
              >
                여기서 시작
              </ActionButton>
              <ActionButton
                variant="ghost"
                onClick={() => {
                  if (window.confirm("예시 질문을 치울까요?"))
                    setCardDeleted(true);
                }}
              >
                치우기
              </ActionButton>
            </div>
          )}
        </div>
      )}
    </section>
  );
  return (
    <div className="nook-preview">
      <div className="preview-ribbon">
        화면 체험 · 가상의 기록이며 입력은 전송·저장되지 않아요
      </div>
      <header className="preview-header">
        <button className="preview-logo" onClick={() => setScreen("start")}>
          nook<span>.</span>
        </button>
        <nav aria-label="시안 화면">
          <button
            aria-current={screen === "start" ? "page" : undefined}
            onClick={() => setScreen("start")}
          >
            책상
          </button>
          <button
            aria-current={screen === "drawer" ? "page" : undefined}
            onClick={() => setScreen("drawer")}
          >
            생각더미
          </button>
        </nav>
        <span className="preview-edition">a little room for thought</span>
      </header>
      {screen === "start" ? (
        <main className="desk-main">
          <section className="desk-intro">
            <p className="eyebrow">잠깐, 내 생각에 머무는 시간</p>
            <h1>
              어떤 이야기부터
              <br />
              꺼내볼까요?
            </h1>
            <div className="desk-light" aria-hidden="true">
              <span />
            </div>
          </section>
          <div className="preview-composer">
            <TextField.Root>
              <TextField.Textarea
                aria-label="생각 적기"
                placeholder="오늘 문득 든 생각은…"
                value={thought}
                onChange={(e) => setThought(e.target.value)}
                maxLength={5000}
              />
            </TextField.Root>
            <div className="preview-composer-bottom">
              <span>한 문장부터.</span>
              <ActionButton variant="neutralWeak" onClick={begin}>
                예시 대화 열기 ↗
              </ActionButton>
            </div>
          </div>
          <div className="preview-examples">
            {["이직을 할까, 말까", "자꾸 마음에 남는 말", "그냥 복잡한 날"].map(
              (t) => (
                <ActionButton
                  key={t}
                  variant="ghost"
                  size="small"
                  onClick={() => setThought(t)}
                >
                  {t}
                </ActionButton>
              ),
            )}
          </div>
          {cards}
          <section className="desk-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">다시 펼쳐볼 수 있도록</p>
                <h2>생각더미</h2>
              </div>
              <button
                className="text-button"
                onClick={() => setScreen("drawer")}
              >
                모두 보기 ↗
              </button>
            </div>
            <Shelf onOpen={openBook} />
          </section>
        </main>
      ) : screen === "drawer" ? (
        <main className="desk-main">
          <p className="eyebrow">끝난 이야기를 꽂아두는 곳</p>
          <h1>생각더미</h1>
          <p className="preview-description">지나온 생각 여섯 번 · 예시</p>
          <Shelf onOpen={openBook} />
          {cards}
        </main>
      ) : screen === "conversation" ? (
        <main className="session-desk">
          <div className="session-top">
            <details className="folded-map">
              <summary>
                <span className="eyebrow">지금 질문</span>
                <strong>{approved ? question : first}</strong>
                <span
                  className="node-indicators"
                  aria-label={
                    approved ? "확정된 질문 두 개" : "확정된 질문 한 개"
                  }
                >
                  ● {approved && "●"} <span aria-hidden="true">⌄</span>
                </span>
              </summary>
              <Path approved={approved} question={question} />
            </details>
            <button
              className="text-button"
              onClick={() => {
                setSelectedBook(5);
                setScreen("path");
              }}
            >
              여기까지 정리하기
            </button>
          </div>
          <section className="flowing-conversation" aria-label="가상의 대화">
            <p className="voice-user">
              이직을 해야 하나 싶어요.
              <br />
              그렇다고 일 자체가 싫어진 건 아닌데.
            </p>
            <p className="voice-nook">
              지금 하는 일에서 바꾸고 싶은 건<br />
              어떤 부분이에요?
            </p>
            <p className="voice-user">
              새로운 일을 해보고 싶은데, 계속 같은 일만 맡아요.
              <br />
              다른 곳에 가야 배울 수 있나 싶고요.
            </p>
          </section>
          {!aside && (
            <section className="preview-proposal" aria-label="질문 제안">
              <p className="eyebrow">질문을 여기에 놓아볼까요?</p>
              {editing ? (
                <TextField.Root>
                  <TextField.Textarea
                    aria-label="제안 질문 수정"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    maxLength={1000}
                  />
                </TextField.Root>
              ) : (
                <h2>{question}</h2>
              )}
              <p>새로운 일을 해보고 싶다는 이야기가 이어졌어요.</p>
              <div className="preview-actions">
                <ActionButton
                  variant="neutralWeak"
                  disabled={approved || !question.trim()}
                  onClick={() => {
                    setApproved(true);
                    setEditing(false);
                    setNotice(
                      "예시 지도에 질문을 놓았어요. 서버에는 저장되지 않아요.",
                    );
                  }}
                >
                  {approved
                    ? "놓아둔 질문"
                    : editing
                      ? "이 질문으로"
                      : "맞아요"}
                </ActionButton>
                <ActionButton
                  variant="neutralWeak"
                  disabled={approved}
                  onClick={() => setEditing(!editing)}
                >
                  {editing ? "수정 닫기" : "고칠게요"}
                </ActionButton>
                <ActionButton
                  variant="ghost"
                  disabled={approved}
                  onClick={() => {
                    setAside(true);
                    setEditing(false);
                  }}
                >
                  밀어두기 →
                </ActionButton>
              </div>
            </section>
          )}
          {aside && (
            <section className="set-aside">
              <p className="eyebrow">한쪽에 밀어둔 질문</p>
              <p>{question}</p>
              <ActionButton variant="ghost" onClick={() => setAside(false)}>
                다시 보기 ↗
              </ActionButton>
            </section>
          )}
          <p className="preview-caption">대화 흐름을 살펴보는 예시예요.</p>
        </main>
      ) : (
        <main className="reading-desk">
          <button className="text-button" onClick={() => setScreen("drawer")}>
            ← 다시 꽂아두기
          </button>
          <article className="open-book">
            <p className="eyebrow">{books[selectedBook].date} · 예시 기록</p>
            <h1>{books[selectedBook].question}</h1>
            <Path
              approved={selectedBook === 5 && approved}
              question={question}
              origin={books[selectedBook].question}
            />
            {selectedBook === 5 && (
              <section className="set-aside">
                <p className="eyebrow">남겨둔 질문</p>
                <p>일 밖에서 새로운 걸 배워볼까?</p>
              </section>
            )}
          </article>
          <p className="preview-caption">대화 전문 대신, 질문이 지나온 자리.</p>
        </main>
      )}
      <p className="preview-status" role="status">
        {notice}
      </p>
      <footer className="preview-footer">
        <span>생각이 머물다 가는 작은 자리.</span>
        <Link href="/">실제 홈으로 ↗</Link>
      </footer>
    </div>
  );
}
