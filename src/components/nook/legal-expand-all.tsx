"use client";
import { useState } from "react";

/** Collapsing a policy costs the reader find-in-page: the browser cannot search
 * text inside a closed `<details>`. This puts it back — one press opens every
 * section, and printing after that gives the whole document.
 */
export function LegalExpandAll() {
  const [open, setOpen] = useState(false);
  function toggle() {
    const next = !open;
    setOpen(next);
    for (const element of document.querySelectorAll<HTMLDetailsElement>(
      "details.legal-section",
    ))
      element.open = next;
  }
  return (
    <button
      type="button"
      className="quiet-link legal-expand-all"
      aria-pressed={open}
      onClick={toggle}
    >
      {open ? "모두 접기" : "모두 펼치기"}
    </button>
  );
}
