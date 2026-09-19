import "server-only";
import { randomUUID } from "node:crypto";
import type { createAdmissionContext } from "./ai-admission";

/** 한 요청의 각 단계가 얼마나 걸리는지, 그리고 그것만 남긴다.
 *
 * 대화 한 턴이 평균 15.3초인데 `judge_logs`가 설명하는 것은 6.4초였고, 첫 질문을
 * 만드는 `/api/start`는 운영 실측으로 8~18초인데 어느 호출이 그 시간을 쓰는지는
 * 어디에도 기록이 없었다. 무엇을 줄여야 하는지 추측으로만 말하게 된다.
 *
 * 모델 호출을 더하지 않는다. 이미 일어나는 호출의 경과 시간만 잰다.
 *
 * 담기는 것은 단계명·소요 시간·설정된 모델·성패뿐이다. 발화도 사용자도 세션도
 * 요청 본문도 들어가지 않는다. `turn`은 이 요청 안에서 만든 난수이고 어디에도
 * 이어지지 않는다 — 한 요청의 여러 줄을 묶기 위한 값이다. 쓰기 실패는 삼킨다:
 * 측정이 요청을 실패시키는 이유가 되어서는 안 된다.
 */
export function createStageTimer(
  admin: Awaited<ReturnType<typeof createAdmissionContext>>["admin"],
) {
  const turn = randomUUID();
  return function stage<T>(
    name: string,
    model: string | null,
    run: () => Promise<T>,
  ): Promise<T> {
    const started = Date.now();
    const done = async (outcome: "ok" | "failed") => {
      const ms = Date.now() - started;
      console.log(
        JSON.stringify({ evt: "nook_stage", stage: name, ms, model, outcome }),
      );
      try {
        await admin
          .from("ai_stage_timings")
          .insert({ turn, stage: name, ms, model, outcome });
      } catch {}
    };
    return run().then(
      async (value) => {
        await done("ok");
        return value;
      },
      async (error) => {
        await done("failed");
        throw error;
      },
    );
  };
}
