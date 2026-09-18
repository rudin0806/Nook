"use client";
import { useEffect, useRef, useState } from "react";
import { ThoughtInput } from "./thought-input";
import { RecoveryList } from "./recovery-list";
import { ThemeControl } from "./theme-control";
import { ShelfPreview } from "./shelf-preview";

/** The desk has one job at a time. Writing is the job, so when the person is
 * writing the page gives the whole width to it and the side column steps out;
 * clicking anywhere else brings it back. The state lives here rather than in
 * ThoughtInput because it is the grid that changes, not the panel.
 */
export function HomeDesk({ enabled }: { enabled: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const surface = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!expanded) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      // A click that lands inside the writing panel is part of writing.
      if (surface.current?.contains(target)) return;
      // A dialog or a CAPTCHA frame is layered above the page rather than
      // inside it, so a click there must not read as "clicked outside".
      if (target instanceof Element && target.closest("dialog, iframe")) return;
      setExpanded(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setExpanded(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [expanded]);

  return (
    <div className="home-bento" data-expanded={expanded || undefined}>
      <div className="home-writing" ref={surface}>
        <ThoughtInput
          enabled={enabled}
          expanded={expanded}
          onExpandedChange={setExpanded}
        />
      </div>
      <aside className="home-aside" inert={expanded}>
        <ThemeControl />
        <ShelfPreview />
        <RecoveryList />
      </aside>
    </div>
  );
}
