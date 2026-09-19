/** One way to print a deadline.
 *
 * `toLocaleString("ko-KR")` with only a time zone prints seconds — "2026. 9.
 * 18. 오후 10:59:17" — and second-precision reads like a countdown on a screen
 * whose point is that there is still time left.
 */
export function formatSeoulDeadline(value: string | Date) {
  return new Date(value).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** 남은 기간은 날짜가 아니라 날 수로 읽힌다.
 *
 * `복원 기한: 9월 23일 오후 11:16 (한국 시간)`은 지금이 며칠인지 알아야 의미가
 * 생기고, 시·분과 시간대까지 달고 있어서 한 줄에서 가장 긴 글이 된다. 남은 날을
 * 세어 주면 계산 없이 읽힌다. 올림이라 기한 당일에도 `1일 뒤`이고, 지났거나 하루가
 * 안 남았으면 날 수를 만들지 않는다.
 */
export function formatDaysLeft(value: string | Date, now: Date = new Date()) {
  const ms = new Date(value).getTime() - now.getTime();
  if (ms <= 0) return "삭제 예정";
  const days = Math.ceil(ms / 86_400_000);
  return days <= 1 ? "오늘 삭제" : `${days}일 뒤 삭제`;
}

/** 목록에 적는 기록의 날짜.
 *
 * 이어갈 대화는 `9월 21일`로, 휴지통은 `2026년 9월 16일`로 적고 있어서 같은 화면의
 * 두 줄이 서로 다른 달력을 쓰는 것처럼 보였다. 올해 기록에는 연도를 적지 않는다 —
 * 지금이 몇 년인지는 읽는 사람이 이미 안다. 해가 바뀐 기록에만 연도가 붙는다.
 */
export function formatRecordDate(value: string | Date, now: Date = new Date()) {
  const date = new Date(value);
  const seoulYear = (d: Date) =>
    new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
    }).format(d);
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    ...(seoulYear(date) === seoulYear(now) ? {} : { year: "numeric" }),
    month: "long",
    day: "numeric",
  }).format(date);
}
