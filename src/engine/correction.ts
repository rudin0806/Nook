/**
 * 사용자가 직전 질문의 전제나 표현을 명시적으로 바로잡았는지 센다.
 *
 * 심리 상태나 숨은 뜻을 추정하지 않는다. 직전 assistant 발화에 답하는 마지막
 * 사용자 발화에 실제로 적힌 `그게 아니라`, `A가 아니라 B`, `A는 아니고 B`
 * 같은 정정 표지만 본다. 문장 첫머리의 `아니`만으로는 정정으로 세지 않는다.
 */
export type CorrectionTurn = { role: "user" | "assistant"; text: string };

/** 앞선 표현을 직접 가리켜 부정하는 경우. 대체 표현이 없어도 정정 표지가 분명하다. */
const REFERENTIAL_CORRECTION =
  /(?:그게|그건|그런\s*(?:게|뜻이)|그\s*뜻은)\s*(?:아니라|아니고|아니야|아니에요|아닙니다|아닌데|아니다|아니었(?:어|어요|다))(?=$|[\s,.!?。])/u;

/** `A가 아니라 B`처럼 부정한 A와 그 뒤의 대체 표현 B가 모두 적힌 경우. */
const CONTRAST_WITH_REPLACEMENT =
  /(?:^|[.!?。]\s*)[^.!?。\n]{1,80}?(?:이|가|은|는|게|건|것은|거는)\s*(?:아니라|아니고|아닌데|아니었고|아니었(?:어|어요))(?=$|[\s,.!?。])([\s\S]*)$/u;

function hasWrittenReplacement(text: string): boolean {
  const match = CONTRAST_WITH_REPLACEMENT.exec(text);
  return /[가-힣A-Za-z0-9]/u.test(match?.[1] ?? "");
}

export function hasExplicitCorrection(
  turns: readonly CorrectionTurn[],
): boolean {
  const last = turns.at(-1);
  const previous = turns.at(-2);
  if (last?.role !== "user" || previous?.role !== "assistant") return false;

  const text = last.text.normalize("NFC");
  return REFERENTIAL_CORRECTION.test(text) || hasWrittenReplacement(text);
}
