/** Deliberate allowlist: the gate only ever returns to an app screen, never to
 * an external URL or an arbitrary path.
 */
const allowed = new Set(["/", "/drawer"]);

export function consentReturnPath(value: unknown): string {
  if (typeof value !== "string") return "/";
  if (allowed.has(value)) return value;
  if (
    /^\/talk\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    return value;
  return "/";
}
