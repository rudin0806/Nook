/** Initial, versioned ending list. Changes require fixture regression checks. */
export const HEDGE_ENDINGS_VERSION = "v1";
export const HEDGE_ENDINGS = [
  "것 같아",
  "것 같기도 해",
  "것 같기도",
  "것 같긴 해",
  "싶기도 해",
  "건가 싶어",
  "나 봐",
  "아마",
  "글쎄",
  "그런 듯",
] as const;

export type HedgeTurn = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

export function hasHedgeEnding(text: string): boolean {
  const ending = text
    .normalize("NFC")
    .trim()
    .replace(/[.!?…。！？\s]+$/gu, "");
  return HEDGE_ENDINGS.some((suffix) => ending.endsWith(suffix));
}

/** Pass the full, non-overlapping session history, not only the Judge window. */
export function calculateHedgeStats(turns: readonly HedgeTurn[]) {
  const ids = new Set<string>();
  let userTurnCount = 0;
  let hedgedTurnCount = 0;
  for (const turn of turns) {
    if (ids.has(turn.id)) throw new Error("DUPLICATE_TURN_ID");
    ids.add(turn.id);
    if (turn.role !== "user") continue;
    userTurnCount++;
    if (hasHedgeEnding(turn.text)) hedgedTurnCount++;
  }
  const hedgeRatio = userTurnCount === 0 ? 0 : hedgedTurnCount / userTurnCount;
  return {
    userTurnCount,
    hedgedTurnCount,
    hedgeRatio,
    hedgeSpeaker: userTurnCount >= 5 && hedgeRatio >= 0.7,
  };
}
