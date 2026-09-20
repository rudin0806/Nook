/**
 * 고민에 대한 답이 아닌 턴 (RULES 5.0.2)
 *
 * `stalled`·`confused`와 같은 구조다. 코드가 세고 모델은 boolean 하나만 받는다.
 * 여기서 보는 것은 **글자의 종류뿐**이고, 사용자가 무엇을 의도했는지는 판단하지
 * 않는다. "무관한 이야기"를 모델이 판정하기 시작하면 곧 상태 추정이 되므로, 판정할
 * 여지가 없는 것만 센다.
 *
 * 한글 음절도, 라틴 글자도, 한자도, 숫자도 하나 없는 턴만 센다. `ㅋㅋㅋ`, `ㅠㅠ`,
 * `ㅇㅇ`, `...`, 이모지만 있는 턴이 여기 걸린다.
 *
 * 걸리지 않는 것들이 이 신호의 경계다.
 *
 *   `응`      한 글자여도 음절이다. 짧은 답도 답이다(Prompt D 4.5).
 *   `70`      숫자만으로도 답이 된다 — "얼마까지 감당할 수 있어요?"
 *   `ok`      라틴 글자.
 *
 * 짧아진 것 자체는 이 신호가 아니라 `stalled`가 센다. 둘을 섞지 않는다.
 */

export type NonAnswerTurn = { role: "user" | "assistant"; text: string };

/** 뜻을 실어 나르는 글자. 자모 낱자(ㄱ-ㅎ, ㅏ-ㅣ)는 음절이 아니므로 뺀다. */
const MEANINGFUL = /[가-힣A-Za-z0-9一-鿿]/u;

export function hasMeaningfulCharacter(text: string): boolean {
  return MEANINGFUL.test(text.normalize("NFC"));
}

/** 마지막 사용자 발화 하나만 본다. 이 신호는 바로 그 턴에 대한 것이다. */
export function isNonAnswer(turns: readonly NonAnswerTurn[]): boolean {
  const last = [...turns].reverse().find((turn) => turn.role === "user");
  if (!last) return false;
  return !hasMeaningfulCharacter(last.text);
}
