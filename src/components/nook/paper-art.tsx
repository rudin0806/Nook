/** Brand still life, not a preview of stored user records. */
export function PaperArt({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`paper-art ${compact ? "paper-art-compact" : ""}`}
      aria-hidden="true"
    >
      <div className="art-shadow" />
      <div className="art-sheet sheet-rose" />
      <div className="art-sheet sheet-green" />
      <div className="art-sheet sheet-lemon">
        <span className="art-rule" />
        <span className="art-monogram">n</span>
        <span className="art-caption">
          room for
          <br />
          your thoughts.
        </span>
        <span className="art-corner" />
      </div>
      <div className="art-ribbon" />
    </div>
  );
}
