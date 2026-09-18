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
