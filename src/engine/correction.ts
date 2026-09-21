/**
 * 사용자가 직전 질문의 전제나 표현을 명시적으로 바로잡았는지 센다.
 *
 * 심리 상태나 숨은 뜻을 추정하지 않는다. 마지막 사용자 발화에 실제로 적힌
 * `그게 아니라`, `A가 아니라 B`, `A는 아닌데` 같은 정정 표지만 본다.
 */
export type CorrectionTurn = { role: "user" | "assistant"; text: string };

const EXPLICIT_CORRECTION =
  /(?:그게|그건|그런\s*(?:게|뜻이)|내\s*말은|내가\s*말한\s*(?:건|게))\s*아니|(?:게|건|것은|거는)\s*아니(?:라|야|고|지|었|ㄴ데|는데)|(?:^|[.!?。]\s*)아니[,.!。]?\s+/u;

export function hasExplicitCorrection(
  turns: readonly CorrectionTurn[],
): boolean {
  const last = [...turns].reverse().find((turn) => turn.role === "user");
  return last ? EXPLICIT_CORRECTION.test(last.text.normalize("NFC")) : false;
}
