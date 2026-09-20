import { z } from "zod";
import { mediumReasonSchema } from "./judge.ts";
export type MediumReason = z.infer<typeof mediumReasonSchema>;
export const questionTypeSchema = z.enum(["PRESENT", "PAST", "COMPARE"]);
/** 질문이 중심 질문에 닿는지, 그 아래 세부로 내려가는지. 모델이 라벨만 내고
 *  연속 횟수를 세는 것과 돌아오라고 시키는 것은 코드가 한다(RULES 8.3). */
export const questionScopeSchema = z.enum(["CENTER", "DETAIL"]);
export const reflectOutputSchema = z.strictObject({
  scope: questionScopeSchema,
  question: z.string().trim().min(1),
  type: questionTypeSchema,
});
export const reflectContextSchema = z.strictObject({
  main_question: z.string().trim().min(1),
  past_probe_count: z.union([z.literal(0), z.literal(1)]),
  last_question_type: questionTypeSchema.nullable(),
  /** 직전에 물은 문장. 같은 질문을 다시 만들지 않기 위한 비교 대상이다.
   *  없으면 비교할 것이 없다는 뜻이고, 그것이 기본값이다. */
  last_question: z.string().trim().min(1).nullable().default(null),
  /** 코드가 센 값. 사용자의 상태가 아니라 답의 길이만 본다(RULES 8.1).
   *  기본값은 신호 없음이므로, 넘기지 않으면 지금까지와 같이 동작한다. */
  stalled: z.boolean().default(false),
  /** 코드가 센 값(RULES 8.2). 방금의 질문이 닿지 않았다고 사용자가 직접 쓴 경우. */
  confused: z.boolean().default(false),
  /** 코드가 센 값(RULES 8.3). 직전까지 DETAIL이 연달아 몇 번 나갔는가.
   *  모델의 기억이 아니라 저장된 라벨을 센 것이다. */
  detail_streak: z.number().int().min(0).max(9).default(0),
  current_clarifications: z.array(
    z.strictObject({ id: z.string(), text: z.string().min(1) }),
  ),
  turns: z
    .array(
      z.strictObject({
        id: z.string(),
        role: z.enum(["user", "assistant"]),
        text: z.string().min(1),
      }),
    )
    .min(1),
  carryover: z
    .array(
      z.strictObject({
        turn: z.string().regex(/^U\d+$/),
        text: z.string().min(1),
      }),
    )
    .max(2),
});
export type ReflectContext = z.infer<typeof reflectContextSchema>;
