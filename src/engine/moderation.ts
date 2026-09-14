import { z } from "zod";

export const MODERATION_CATEGORIES = [
  "harassment",
  "harassment/threatening",
  "hate",
  "hate/threatening",
  "illicit",
  "illicit/violent",
  "self-harm",
  "self-harm/instructions",
  "self-harm/intent",
  "sexual",
  "sexual/minors",
  "violence",
  "violence/graphic",
] as const;
export const moderationSignalSchema = z.strictObject({
  flagged: z.boolean(),
  flagged_categories: z.array(z.enum(MODERATION_CATEGORIES)).max(13),
});
export type ModerationSignal = z.infer<typeof moderationSignalSchema>;
const categoriesSchema = z.object({
  harassment: z.boolean(),
  "harassment/threatening": z.boolean(),
  hate: z.boolean(),
  "hate/threatening": z.boolean(),
  illicit: z.boolean().nullable(),
  "illicit/violent": z.boolean().nullable(),
  "self-harm": z.boolean(),
  "self-harm/instructions": z.boolean(),
  "self-harm/intent": z.boolean(),
  sexual: z.boolean(),
  "sexual/minors": z.boolean(),
  violence: z.boolean(),
  "violence/graphic": z.boolean(),
});
const responseSchema = z.object({
  results: z
    .array(z.object({ flagged: z.boolean(), categories: categoriesSchema }))
    .length(1),
});
/** Scores/provider metadata are deliberately not forwarded or persisted. */
export function readModerationSignal(raw: unknown): ModerationSignal {
  const result = responseSchema.safeParse(raw);
  if (!result.success) throw new Error("MODERATION_OUTPUT_INVALID");
  const row = result.data.results[0];
  return {
    flagged: row.flagged,
    flagged_categories: MODERATION_CATEGORIES.filter(
      (key) => row.categories[key] === true,
    ),
  };
}
