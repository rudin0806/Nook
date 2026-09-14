# Judge 런타임 어댑터

기준일 2026-09-14. Prompt B의 최종 fixture 회귀 뒤, 실제 서비스 흐름이 사용할 서버 전용
Judge 호출 경계를 추가했다. 이 작업에서는 공개 API Route나 실제 유료 모델 호출을 만들지 않았다.

## 구현 범위

- `src/engine/judge.ts`: 입력 준비, 서버 세션 대조, 요청 상한, 출력의 구조·참조 검증
- `src/lib/openai/judge.ts`: 서버 전용 Responses API 호출과 안전한 결과 메타데이터 반환
- `src/schemas/judge.ts`: 입력·출력 Zod 계약과 절대 개수 상한
- `src/lib/env/server.ts`: 운영 모델·reasoning·출력 상한 환경변수 검증

`runJudge`는 검증된 `output`과 모델·추론 강도·프롬프트 버전·지연·토큰 사용량만 반환한다.
입력 원문과 검증 전 모델 출력은 Nook DB나 애플리케이션 로그에 기록하지 않는다.

## 입력 소유권과 맥락

호출부는 브라우저가 보낸 Judge payload를 그대로 넘기지 않고, 인증된 세션을 DB에서 읽어
`main_question`, `main_path`, 현재 Clarification, Branch 후보, carryover와 최근 창을 조립해야 한다.

어댑터는 다음을 추가로 확인한다.

1. 최근 창은 서버가 읽은 전체 세션의 최신 연속 구간이며 마지막 턴은 사용자 발화다.
2. 창의 id·role·text는 서버 세션과 글자까지 일치한다.
3. carryover는 창보다 앞선 실제 사용자 발화이고 id·text가 서버 세션과 일치한다.
4. 모델이 반환한 근거 id는 최근 사용자 창 또는 명시적 carryover에만 존재한다.
5. 무효화 Clarification과 승격 Branch id는 현재 입력에 실제 존재한다.

전체 세션 원문은 `hedge_speaker` 계산에만 사용한다. 모델 요청에는 최근 창과 명시적 carryover,
계산한 boolean만 들어가며 전체 history와 hedge ratio는 들어가지 않는다.

## 비용·오류·보존 경계

- 모델 allowlist: `gpt-5.6-luna`, `gpt-5.6-terra`, `gpt-5.6-sol`
- reasoning allowlist: `low`, `medium`, `high`
- 출력 상한: 256~2048토큰. reasoning token도 이 상한에 포함된다.
- SDK timeout 30초, 자동 재시도 0회. 호출부가 임의 재시도하지 않는다.
- Responses 요청은 `store: false`다. 이는 API 응답을 나중에 조회하도록 저장하지 않는 설정이며,
  조직의 Zero Data Retention 보유를 주장하는 표현으로 사용하지 않는다.
- provider 원문 오류·검증 전 JSON은 외부 응답에 노출하지 않는다.

GitHub Actions 평가는 repository secret `AI_API_KEY`를 workflow 안에서 `OPENAI_API_KEY`로
전달한다. 로컬·Vercel 런타임은 `OPENAI_API_KEY`와 `NOOK_JUDGE_MODEL`,
`NOOK_JUDGE_REASONING_EFFORT`, `NOOK_JUDGE_MAX_OUTPUT_TOKENS`를 별도로 설정한다.

## 의도적으로 연결하지 않은 것

Judge를 바로 호출할 수 있는 API Route는 추가하지 않았다. 다음 선행 순서가 아직 하나의 서버
트랜잭션 흐름으로 구현되지 않았기 때문이다.

1. Safety 분류와 결정론적 behavior 매핑
2. 사용자의 명시적 종료 의사 처리
3. Node·turn·Branch·PAST 구조 상한
4. Judge 실행
5. SHIFT면 Prompt C, REFLECT면 Prompt D, CLOSE면 정리 제안
6. 검증된 Judge Log·Clarification·Branch·승인된 Node의 원자적 저장

특히 STOP 원문 미저장과 HANDOFF 원문 저장 규칙이 먼저 보장되지 않은 공개 경로에서 Judge를
호출하면 안 된다.

## 검증

- 런타임 단위 테스트 5개: history 비노출, 최신 창 일치, carryover 일치, 출력 참조 무결성,
  Astra/xhigh/초과 출력/잘못된 JSON 거절
- 기존 Judge 규칙 테스트 8개 통과
- 전체 단위 테스트 46개 통과
- Judge fixture 32개 정적 검증 통과

이번 어댑터 작업에서 유료 모델 호출은 다시 실행하지 않았다. Prompt B와 2048 출력 상한의 실제
모델 기준선은 [Sol high 최종 회귀](2026-09-14-judge-sol-tuning.md)의 strict 31/31 결과를 사용한다.
