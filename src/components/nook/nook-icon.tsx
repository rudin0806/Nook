type IconName = "write" | "lamp" | "pile" | "conversation" | "home" | "account";

type IconTone = "blue" | "orange" | "lime";

const paths: Record<IconName, React.ReactNode> = {
  write: (
    <>
      <path d="M12 11.5h16a5 5 0 0 1 5 5v15a5 5 0 0 1-5 5H13a5 5 0 0 1-5-5V16.5a5 5 0 0 1 4-4.9" />
      <path d="m17 28 2.2-6.7L32.7 7.8a3.2 3.2 0 0 1 4.5 4.5L23.7 25.8 17 28Z" />
      <path d="m29.8 10.7 4.5 4.5" />
    </>
  ),
  lamp: (
    <>
      <path d="M16 10h16l4 13H12l4-13Z" />
      <path d="M24 23v11M18 37h12" />
      <path d="M18 5v2M30 5v2M38 12h-2M12 12h-2" />
    </>
  ),
  pile: (
    <>
      <rect x="8" y="14" width="11" height="23" rx="3" />
      <rect x="20" y="9" width="11" height="28" rx="3" />
      <path d="m33 14 7-1 2.7 22-7 1L33 14Z" />
      <path d="M23.5 14h4M11.5 19h4M36.5 19l3-.4" />
    </>
  ),
  conversation: (
    <>
      <path d="M9 15.5 28 11a4 4 0 0 1 4.8 3l3.7 15.8a4 4 0 0 1-3 4.8l-19 4.4a4 4 0 0 1-4.8-3L6 20.3a4 4 0 0 1 3-4.8Z" />
      <path d="M14 20.5h13M15 26h10M16 31.5h7" />
      <path d="M13 11.5 30 7a4 4 0 0 1 4.8 3" />
    </>
  ),
  home: (
    <>
      <path d="m8 22 16-13 16 13v15H8V22Z" />
      <path d="M19 37V25h10v12" />
      <circle cx="34" cy="18" r="2" />
    </>
  ),
  account: (
    <>
      <circle cx="24" cy="17" r="7" />
      <path d="M11 39c1.2-8 5.6-12 13-12s11.8 4 13 12" />
      <path d="M14 37h20" />
    </>
  ),
};

export function NookIcon({
  name,
  tone,
  compact = false,
  tile = false,
}: {
  name: IconName;
  tone: IconTone;
  compact?: boolean;
  /** A panel heading sets this: the glyph sits white inside a tinted, slightly
   * tilted square instead of floating as a coloured outline. At 26px a line
   * icon on paper reads as debris next to a heading; a filled tile gives it a
   * shape and lets the tone carry meaning without tinting the text. */
  tile?: boolean;
}) {
  return (
    <span
      className="nook-icon"
      data-tone={tone}
      data-compact={compact || undefined}
      data-tile={tile || undefined}
      aria-hidden="true"
    >
      <svg viewBox="0 0 48 48" fill="none">
        <g
          stroke="currentColor"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {paths[name]}
        </g>
      </svg>
    </span>
  );
}
