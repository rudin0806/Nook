"use client";
import { useSyncExternalStore } from "react";
import { NookIcon } from "./nook-icon";
const key = "nook-theme-v1";
function subscribe(callback: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  window.addEventListener("nook-theme", callback);
  window.addEventListener("storage", callback);
  media.addEventListener("change", callback);
  return () => {
    window.removeEventListener("nook-theme", callback);
    window.removeEventListener("storage", callback);
    media.removeEventListener("change", callback);
  };
}
function snapshot() {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(key);
  } catch {}
  const dark =
    saved === "dark" ||
    (saved !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
  return dark;
}
export function ThemeControl() {
  const dark = useSyncExternalStore(subscribe, snapshot, () => false);
  function toggle() {
    const next = dark ? "light" : "dark";
    try {
      localStorage.setItem(key, next);
    } catch {}
    document.documentElement.dataset.theme = next;
    document.documentElement.dataset.seedColorMode = `${next}-only`;
    window.dispatchEvent(new Event("nook-theme"));
  }
  return (
    <section
      className="lamp-panel"
      data-lit={!dark}
      aria-label="조명과 화면 테마"
    >
      <NookIcon name="lamp" tone="lime" />
      <div className="lamp-copy">
        <h2>조명</h2>
        <p>
          {dark
            ? "조명이 꺼져 있어요 · 어두운 화면"
            : "조명이 켜져 있어요 · 밝은 화면"}
        </p>
      </div>
      <button
        className="lamp-toggle"
        role="switch"
        aria-checked={!dark}
        aria-label={dark ? "조명 켜기 · 라이트 모드" : "조명 끄기 · 다크 모드"}
        onClick={toggle}
      >
        <span aria-hidden="true" />
      </button>
    </section>
  );
}
