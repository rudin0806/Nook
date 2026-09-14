"use client";
import { useState } from "react";
import { ActionButton, TextField } from "@seed-design/react";
export function ThoughtInput() {
  const [thought, setThought] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [light, setLight] = useState(true);
  return (
    <div
      className="writing-room"
      data-light={light ? "on" : "dim"}
      data-expanded={expanded}
    >
      <div className="desk-illumination" aria-hidden="true" />
      <button
        className="desk-lamp"
        onClick={() => setLight(!light)}
        aria-label="책상 조명"
        aria-pressed={light}
      >
        <span className="lamp-shade" aria-hidden="true" />
        <span className="lamp-stem" aria-hidden="true" />
        <span className="lamp-foot" aria-hidden="true" />
        <span className="lamp-label">조명 {light ? "켜짐" : "낮춤"}</span>
      </button>
      <section
        className="writing-surface"
        aria-label="내 생각 쓰기"
        onKeyDown={(e) => {
          if (e.key === "Escape") setExpanded(false);
        }}
      >
        <div className="paper-top">
          <span className="paper-dot" aria-hidden="true" />
          <span>나만의 생각 자리</span>
          <ActionButton
            variant="ghost"
            size="small"
            aria-expanded={expanded}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "접어두기 ↙" : "넓게 쓰기 ↗"}
          </ActionButton>
        </div>
        <h1>생각나는 대로.</h1>
        <TextField.Root className="writing-field">
          <TextField.Textarea
            id="raw-thought"
            className="writing-textarea"
            name="rawThought"
            aria-label="생각 적기"
            aria-describedby="writing-availability"
            placeholder="지금 떠오르는 이야기를 적어볼까요?"
            value={thought}
            onChange={(e) => setThought(e.target.value)}
            maxLength={5000}
            autoComplete="off"
          />
        </TextField.Root>
        <div className="paper-bottom">
          <p id="writing-availability">
            대화 연결 준비 중 · 입력은 저장되지 않아요.
          </p>
          <ActionButton
            variant="neutralWeak"
            size="medium"
            disabled
            aria-label="대화 시작, 아직 준비 중"
          >
            시작하기 <span aria-hidden="true">↗</span>
          </ActionButton>
        </div>
      </section>
      <div className="desk-front" aria-hidden="true" />
      <p className="desk-signature">답보다, 내 질문에 가까워지는 시간.</p>
    </div>
  );
}
