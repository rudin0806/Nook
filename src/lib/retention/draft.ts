import { z } from "zod";
export const retentionDraftSchema = z.object({
  userId: z.uuid(),
  sessionId: z.uuid(),
  selected: z.array(z.uuid()).max(50),
  expiresAt: z.number().int(),
});
export function readRetentionDraft(
  raw: string | null,
  userId: string,
  sessionId: string,
  now = Date.now(),
) {
  try {
    const value = retentionDraftSchema.parse(JSON.parse(raw ?? "null"));
    if (
      value.userId !== userId ||
      value.sessionId !== sessionId ||
      value.expiresAt <= now ||
      value.expiresAt > now + 600_000
    )
      return null;
    return value;
  } catch {
    return null;
  }
}
export const retentionDraftKey = (sessionId: string) =>
  `nook-retention:${sessionId}`;
