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
