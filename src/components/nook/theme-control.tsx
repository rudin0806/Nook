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
export function ThemeControl({ compact = false }: { compact?: boolean }) {
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
  const label = dark ? "조명 켜기 · 라이트 모드" : "조명 끄기 · 다크 모드";
  // 탭바에 서는 꼴. 도시락 칸 하나를 차지하던 판이 쓰기와 더미 사이에 끼어 있어서
  // 읽을 것과 만질 것이 같은 격자에 섞였다. 조명은 화면 전체의 설정이므로 화면
  // 전체를 이고 있는 줄로 올라간다.
  if (compact)
    return (
      <button
        className="lamp-switch"
        data-lit={!dark}
        role="switch"
        aria-checked={!dark}
        aria-label={label}
        title={label}
        onClick={toggle}
      >
        <NookIcon name="lamp" tone="orange" compact />
        <span className="lamp-switch-track" aria-hidden="true">
          <span />
        </span>
      </button>
    );
  return (
    <section
      className="lamp-panel"
      data-lit={!dark}
      aria-label="조명과 화면 테마"
    >
      <NookIcon name="lamp" tone="orange" tile />
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
        aria-label={label}
        onClick={toggle}
      >
        <span aria-hidden="true" />
      </button>
    </section>
  );
}
