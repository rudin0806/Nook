import { z } from "zod";
import { mediumReasonSchema } from "./judge.ts";
export type MediumReason = z.infer<typeof mediumReasonSchema>;
export const questionTypeSchema = z.enum(["PRESENT", "PAST", "COMPARE"]);
/** 질문이 중심 질문에 닿는지, 그 아래 세부로 내려가는지. 모델이 라벨만 내고
 *  연속 횟수를 세는 것과 돌아오라고 시키는 것은 코드가 한다(RULES 5.4.6). */
export const questionScopeSchema = z.enum(["CENTER", "DETAIL"]);

/** 코드가 우선순위에 따라 하나만 선택한다. 모델은 모드를 판정하지 않는다. */
export const reflectModeSchema = z.enum([
  "DEFAULT",
  "MEDIUM",
  "CORRECTION",
  "CONFUSED",
  "NON_ANSWER",
  "RETURN_CENTER",
]);
export type ReflectMode = z.infer<typeof reflectModeSchema>;

/** 질문의 목적. 자유 형식 rationale 대신 이 작은 집합으로 생성·평가한다. */
export const questionMoveSchema = z.enum([
  "CONNECT",
  "CRITERION",
  "COUNTERWEIGHT",
  "PRIORITY",
  "SYNTHESIS",
  "RECOVERY",
]);
export type QuestionMove = z.infer<typeof questionMoveSchema>;

export const reflectOutputSchema = z
  .strictObject({
    scope: questionScopeSchema,
    move: questionMoveSchema,
    question: z.string().trim().min(1),
    type: questionTypeSchema,
    /** 질문의 발판이 된 사용자 발화와 그 안의 연속 인용. 복구 모드는 둘 다 null일 수 있다. */
    source_turn: z
      .string()
      .regex(/^U\d+$/)
      .nullable(),
    source_quote: z.string().trim().min(1).max(1_000).nullable(),
  })
  .superRefine((output, ctx) => {
    if ((output.source_turn === null) !== (output.source_quote === null))
      ctx.addIssue({
        code: "custom",
        message:
          "source_turn and source_quote must both be set or both be null",
      });
  });
export type ReflectOutput = z.infer<typeof reflectOutputSchema>;
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
  /** 코드가 센 값(RULES 5.0.1). 방금의 질문이 닿지 않았다고 사용자가 직접 쓴 경우. */
  confused: z.boolean().default(false),
  /** 코드가 센 값(RULES 5.0.2). 이 턴에 뜻을 실은 글자가 하나도 없다. */
  non_answer: z.boolean().default(false),
  /** 마지막 사용자 발화가 직전 질문의 전제·표현을 명시적으로 바로잡았는가. */
  corrected_previous_frame: z.boolean().default(false),
  /** 코드가 센 값(RULES 5.4.6). 직전까지 DETAIL이 연달아 몇 번 나갔는가.
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
