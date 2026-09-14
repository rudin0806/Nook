import { z } from "zod";
import { rawThoughtSchema } from "./start.ts";
export const startRequestSchema = z.strictObject({
  requestId: z.uuid(),
  thought: rawThoughtSchema,
  captchaToken: z.string().min(1).max(4096).optional(),
});
export const approvalRequestSchema = z.strictObject({
  requestId: z.uuid(),
  receipt: z.string().min(1).max(32000),
  finalText: rawThoughtSchema,
});
export const focusRequestSchema = z.strictObject({
  requestId: z.uuid(),
  receipt: z.string().min(1).max(32000),
  index: z.number().int().min(0).max(9),
});
