/**
 * 분명해진 것의 기준 (RULES 6.2)
 *
 * 화면의 `분명해진 것`은 **사용자가 정한 것**을 모으는 칸이다. 사용자가 말한 것을
 * 모으는 칸이 아니다.
 *
 * 운영에서는 후자가 됐다. 저장된 22개가 전부 사용자 발화 한 줄을 3인칭으로 바꾼
 * 것이었다 — `배우고 싶어` → `배우고 싶음`, `사수도 없고` → `사수가 없음`. 한 턴이
 * 한두 항목을 만들어 목록이 전사가 됐고, 여섯 줄이 쌓여도 고민은 한 칸도 좁혀지지
 * 않았다.
 *
 * 여기서 세는 것은 **어미와 표지뿐**이다. 뜻이 좁혀졌는지는 판단하지 않는다 — 그것을
 * 코드가 판단하려 들면 곧 상태 추정이 된다. 글자로 분명히 가릴 수 있는 두 가지만
 * 본다.
 *
 *   RESTATED   `~다고 함`, `~라고 말함` — 사용자가 말했다는 사실 자체를 적은 것.
 *              무엇이 분명해졌는지가 아니라 무엇을 말했는지를 적고 있다.
 *   UNSETTLED  `고민 중임`, `확신하지 못함`, `모르겠음`, `우려함`, `~하려 함` —
 *              아직 정해지지 않았다는 말. 분명해진 것은 정해진 것이다.
 *
 * 글자만 보기 때문에 놓치는 것이 있다. `지금 마음이 너무 힘듦`처럼 중심 질문을 그대로
 * 되풀이한 항목은 여기서 걸리지 않는다 — 그것은 Prompt A의 규칙이 맡는다.
 *
 * 걸린 항목은 **버리고 턴은 그대로 간다.** clarification은 더해지는 것이라 하나를
 * 빼도 대화가 끊기지 않는다. 판정 하나가 유료 호출이므로 항목 하나 때문에 턴 전체를
 * 실패시키지 않는다.
 */

/** 사용자가 말했다는 사실 자체를 적은 꼴. */
const RESTATED = /(다|라|자|냐)고\s*(함|말함|말하고 있음|밝힘|이야기함)\s*$/u;
/** 아직 정해지지 않았다는 꼴. */
const UNSETTLED =
  /(고민\s*(중임|하고 있음)|확신하지\s*못함|확신이\s*없음|모르겠음|모름|궁금함|우려함|걱정함|망설임|고민됨|(려|으려)\s*함)\s*$/u;

export type ClarificationFlag = "RESTATED" | "UNSETTLED";

export function inspectClarification(text: string): ClarificationFlag[] {
  const value = text.normalize("NFC").trim();
  const flags: ClarificationFlag[] = [];
  if (RESTATED.test(value)) flags.push("RESTATED");
  if (UNSETTLED.test(value)) flags.push("UNSETTLED");
  return flags;
}

/** 기준을 통과한 것만 남긴다. 무엇이 왜 빠졌는지는 호출한 쪽이 기록한다. */
export function keepClarifications<T extends { text: string }>(
  items: readonly T[],
): { kept: T[]; dropped: { text: string; flags: ClarificationFlag[] }[] } {
  const kept: T[] = [];
  const dropped: { text: string; flags: ClarificationFlag[] }[] = [];
  for (const item of items) {
    const flags = inspectClarification(item.text);
    if (flags.length) dropped.push({ text: item.text, flags });
    else kept.push(item);
  }
  return { kept, dropped };
}
