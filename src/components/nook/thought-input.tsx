"use client";
import { useState } from "react";
import Link from "next/link";
import { ActionButton, TextField } from "@seed-design/react";
export function ThoughtInput() {
  const [thought, setThought] = useState("");
  return (
    <section aria-label="생각 적기">
      <div className="thought-composer">
        <TextField.Root className="thought-field">
          <TextField.Textarea
            id="raw-thought"
            name="rawThought"
            className="thought-textarea"
            placeholder="오늘 문득 든 생각은…"
            aria-label="생각 적기"
            aria-describedby="thought-privacy"
            maxLength={5000}
            value={thought}
            onChange={(e) => setThought(e.target.value)}
            autoComplete="off"
          />
        </TextField.Root>
        <div className="preview-composer-bottom">
          <p id="thought-privacy" className="input-note">
            아직 전송·저장되지 않아요.
          </p>
          <Link className="desk-link" href="/preview">
            예시 화면 체험 ↗
          </Link>
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
    </section>
  );
}
