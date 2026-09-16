"use client";
import { ThoughtInput } from "./thought-input";
import { RecoveryList } from "./recovery-list";
import { ThemeControl } from "./theme-control";
import { ShelfPreview } from "./shelf-preview";
export function HomeDesk({ enabled }: { enabled: boolean }) {
  return (
    <div className="home-bento">
      <ThoughtInput enabled={enabled} />
      <ThemeControl />
      <ShelfPreview />
      <RecoveryList />
    </div>
  );
}
