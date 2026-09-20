/**
 * 정체 판정 (RULES 8.1)
 *
 * 되묻기가 같은 방향으로 계속되는데 사용자의 답이 연속으로 짧아지면, 그 방향은 더
 * 나오지 않는 것으로 본다. 대화를 멈출 자리를 찾기 위한 신호다.
 *
 * **사용자의 상태를 추정하지 않는다.** 지쳤는지 방어하는지는 여기서 판단할 수 없고
 * 판단하려 하지도 않는다. 세는 것은 글자 수 하나뿐이다. 그 사람이 앞서 쓰던 길이에
 * 견줘 갑자기 짧아졌는가, 그게 두 번 연속인가.
 *
 * 자기 기준과 비교하므로 원래 짧게 답하는 사람에게는 걸리지 않는다. 중앙값이 8자인
 * 사람의 8자 답은 8자보다 짧아진 것이 아니다.
 *
 * 처음에는 "새 재료 없이"까지 세려 했다. 한국어에서 그것을 형태소 없이 세면
 * `주기적인 돌봄들`은 새 재료가 있는 것으로, `그런건 알아서 뭐하게`는 새 재료가 세
 * 개 있는 것으로 잡힌다 — 뜻과 정반대다. 그래서 세지 않는다. 여기서 재는 것은 길이뿐이고
 * 그 이름으로 부른다.
 *
 * 코드가 세고 LLM은 플래그를 받아 판단만 한다. hedge_speaker와 같은 구조다.
 */

export type StallTurn = { role: "user" | "assistant"; text: string };

/** 값을 바꾸면 fixture의 expected_stalled가 깨진다 */
/** 몇 번 연속으로 짧아져야 정체로 보는가 */
export const STALL_RUN = 2;
/** 비교 기준을 만들 만큼의 앞선 발화가 있어야 한다 */
export const STALL_MIN_HISTORY = 2;
/** 앞선 발화 중앙값의 몇 배 아래를 "짧아졌다"로 보는가 */
export const STALL_RATIO = 0.5;
/** 그 비율을 통과해도 이 길이를 넘으면 짧은 답이 아니다 */
export const STALL_ABSOLUTE = 20;
/** 비율을 재려면 기준선에 잴 것이 있어야 한다. 한두 단어보다 짧은 기준선에서는
 *  0.5배가 한 글자 차이라 잡음이 된다. */
export const STALL_MIN_BASELINE = 8;

/** 길이는 눈에 보이는 글자로 센다. 공백과 종결 부호는 내용이 아니다. */
export function replyLength(text: string): number {
  return text
    .normalize("NFC")
    .replace(/\s+/g, "")
    .replace(/[.!?。！？~…,·]+/g, "").length;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * 마지막 STALL_RUN개의 사용자 발화가 그 앞 발화들에 견줘 모두 짧아졌는가.
 *
 * 기준선은 판정 대상에서 제외한 앞선 발화들의 중앙값이다. 평균이 아니라 중앙값인
 * 것은 유난히 긴 한 발화가 기준을 끌어올려 이후 평범한 답까지 짧아진 것으로 만들지
 * 않기 위해서다.
 */
export function isStalled(turns: readonly StallTurn[]): boolean {
  const lengths = turns
    .filter((turn) => turn.role === "user")
    .map((turn) => replyLength(turn.text));
  if (lengths.length < STALL_RUN + STALL_MIN_HISTORY) return false;
  const recent = lengths.slice(-STALL_RUN);
  const baseline = median(lengths.slice(0, -STALL_RUN));
  // 여기서 `baseline <= STALL_ABSOLUTE`(20자)를 막고 있었다. 원래 짧게 쓰는 사람을
  // 보호하려던 조건인데, 그 보호는 아래 비율 비교가 이미 하고 있었고(자기 중앙값과
  // 견준다) 이 줄은 **짧게 쓰는 사람에게 기능 자체를 없애고 있었다.** 운영에서 관찰된
  // 대화의 중앙값이 13자라 감지기가 시작도 하지 못했다. 잡음만 막을 만큼만 남긴다.
  if (baseline < STALL_MIN_BASELINE) return false;
  return recent.every(
    (length) => length <= baseline * STALL_RATIO && length < STALL_ABSOLUTE,
  );
}
