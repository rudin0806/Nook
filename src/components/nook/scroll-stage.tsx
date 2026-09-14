"use client";
import { useEffect, useRef, type ReactNode } from "react";
/** Decorative motion only: never intercepts scrolling or moves the focused input. */
export function ScrollStage({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const paint = () => {
      frame = 0;
      const progress = reduced.matches
        ? 0
        : Math.min(
            1,
            Math.max(0, -root.getBoundingClientRect().top / window.innerHeight),
          );
      root.style.setProperty("--journey", String(progress));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
      },
      { threshold: 0.12 },
    );
    root
      .querySelectorAll(".reveal-panel")
      .forEach((element) => observer.observe(element));
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    reduced.addEventListener("change", schedule);
    paint();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      reduced.removeEventListener("change", schedule);
    };
  }, []);
  return (
    <div className="scroll-stage" ref={ref}>
      {children}
    </div>
  );
}
