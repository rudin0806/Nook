"use client";

import { TextField } from "@seed-design/react";

/** STEP 1 input only: no persistence, API submission, or simulated AI response. */
export function ThoughtInput() {
  return (
    <section className="thought-composer" aria-label="생각 적기">
      <label id="thought-label" htmlFor="raw-thought" className="input-label">
        어떤 생각이 드나요?
      </label>
      <TextField.Root className="thought-field">
        <TextField.Textarea
          id="raw-thought"
          name="rawThought"
          className="thought-textarea"
          placeholder="어디서부터 말해야 할지 모르겠다면, 그 말부터."
          maxLength={5000}
          aria-describedby="thought-privacy"
          aria-labelledby="thought-label"
          autoComplete="off"
          spellCheck={false}
        />
      </TextField.Root>
      <p id="thought-privacy" className="input-note">
        입력한 내용은 전송하거나 저장하지 않아요.
      </p>
    </section>
  );
}
