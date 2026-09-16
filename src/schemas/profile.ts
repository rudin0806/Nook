import { z } from "zod";

export const nicknameSchema = z
  .string()
  .trim()
  .normalize("NFC")
  .min(1)
  .max(20)
  .regex(
    /^[\p{L}\p{N} _-]+$/u,
    "1~20자의 글자, 숫자, 공백, 밑줄, 하이픈을 사용해 주세요.",
  );
export const profileInputSchema = z
  .object({ nickname: nicknameSchema })
  .strict();
export function readNickname(value: unknown): string | null {
  const parsed = nicknameSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
