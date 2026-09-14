"use client";
import { useState } from "react";
import { ActionButton, TextField } from "@seed-design/react";
export function ThoughtInput() {
  const [thought, setThought] = useState("");
  const [expanded, setExpanded] = useState(false);
  return (
    <section
      className="writing-surface"
      data-expanded={expanded}
      aria-label="내 생각 쓰기"
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
      <h1>생각나는 대로.</h1>
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
          autoComplete="off"
        />
      </TextField.Root>
      <div className="paper-bottom">
        <p id="writing-availability">
          대화 연결 준비 중<br />
          입력은 전송·저장되지 않아요.
        </p>
        <ActionButton
          variant="neutralWeak"
          disabled
          aria-label="대화 시작, 아직 준비 중"
        >
          시작하기 <span aria-hidden="true">↗</span>
        </ActionButton>
      </div>
    </section>
  );
}
