# Nook 병행 작업 안내

제품 기준은 main의 PRD, 개발 진행 상태는 STATUS다. 이 문서는 역할과 전달 형식만 정하며 제품 규칙을 새로 만들지 않는다.

## 역할 분담

| 담당 | 맡을 일 | 수정 범위 |
|---|---|---|
| Codex | 스키마·API·인증·RLS·화면 구현, 평가기 실행, 통합·회귀검사·병합 | 코드, migration, 승인된 기준 문서 |
| Claude | 프롬프트 초안과 개선안, 오답 원인 분석, 경계 사례 제안, UX 문구·사용성 테스트·발표 논리 | 작업별 제안서 `docs/proposals/<task-id>.md` |
| 수연 | 제품 의미가 달라지는 선택 확정 | 충돌 항목에 대한 결정 |

프롬프트도 서비스 동작의 일부다. Claude가 문안을 제안하면 Codex가 입출력 스키마와 테스트를 확인해 `src/prompts/`에 반영한다. 두 도구가 동일한 기준 파일을 동시에 수정하지 않는다.

## 현재 기준

- main: 확정된 PRD 및 저장 규칙. HANDOFF 상태는 기존 main의 `HANDOFF_STOPPED`를 유지한다.
- [PR #2](https://github.com/rudin0806/Nook/pull/2): 문서·평가·AI 엔진·API 보완 작업 브랜치. 전체 병합 전이다.
- Judge 32 / Start 17 / Safety 15. Safety category 계약 불일치 8건은 미해결이다.
- Prompt B는 `gpt-5.6-sol` reasoning high의 Judge strict 31/31 회귀를 통과했다. 한 번의 fixture 결과이며 실사용 정확도나 운영 모델 확정을 뜻하지 않는다.
- Prompt D는 통합됐고 Judge 서버 전용 어댑터도 구현됐다. Prompt C 내부 어댑터도 통합됐고, 전체 Safety→Judge→C/D 저장 배선은 남았다.

## 작업 이력과 다음 위임

### C-01 — 충돌 항목 검토 (Safety 계약 미결)

HANDOFF 상태는 `HANDOFF_STOPPED`, carryover의 `medium_reason`은 세 enum으로 확정됐다. 남은 범위는
Safety뿐이다. 필요한 입력은 PRD·RULES·EVALSET의 Safety 절과 S-01~S-15,
`eval/safety_mapping.json`이다.

산출물: `항목 / 두 문서의 차이 / 추천안 / 영향 받는 필드·케이스 / 사용자 결정 필요 여부` 표 하나.

검토할 차이:

1. Safety category의 `null/NONE`, `THIRD_PARTY_RISK/SUICIDE_SELF_HARM`, `MENTAL_HEALTH_CARE/GENERAL_MENTAL_HEALTH`.
2. fixture contact 표시 문자열과 mapping의 `primary/urgent` 객체 비교 방식.
3. S-14 제3자 도움 안내와 전달 요청 문구.
4. Safety Classifier 입력·출력과 STOP/HANDOFF 처리 경계 사례.

추천을 결정 완료로 바꾸거나 정답 JSONL의 라벨을 수정하지 않는다.

### C-02 — Prompt D 초안과 말투 검토 (완료)

Claude 산출물을 Codex가 스키마·근거 전달·PAST 제한과 함께 통합했다. 현재 기준은
[`src/prompts/prompt-reflect.ts`](../src/prompts/prompt-reflect.ts)와
[`통합 기록`](reviews/2026-09-13-C-02-integration.md)이다.

### C-03 — Judge 프롬프트와 오답 분석 (완료)

Prompt B 최소 수정과 실패 subset 재검증을 거쳐 Sol high strict 31/31을 기록했다. 현재 기준은
[`src/prompts/prompt-judge.ts`](../src/prompts/prompt-judge.ts)와
[`조정 기록`](reviews/2026-09-14-judge-sol-tuning.md)이다.

### Prompt C v2 — 내부 서버 통합 완료, 생성 품질 평가 전

v2는 `src/prompts/prompt-reframe.ts`와 `src/engine/reframe.ts`에 통합했다. [통합 기록](reviews/2026-09-14-prompt-c-integration.md)을 따른다. 이후 Claude 작업은 기존 프롬프트 예시와 겹치지 않는 C 평가 사례 및 문장 검토다.

Judge가 `SHIFT/HIGH`를 반환한 뒤 사용자 확인 전 보여줄 **새 중심 질문과 근거 한 줄**을 만든다.
RULES의 Reframe 경계, PRD의 Shift Proposal·User Confirm, Judge 출력 스키마만 읽는다. Judge 판정을
다시 판단하거나 Node를 확정 저장하지 않는다.

산출물은 프롬프트 초안, 입력·출력 필드 제안, 일반/경계 사례 8개, 과잉해석 금지 점검표다.
Codex가 최종 Zod 스키마·호출 형식·사용자 확인·DB 저장을 구현하므로 코드나 기준 문서를 직접
수정하지 않는다.

### 이후 적합한 업무

- AI가 먼저 대조를 제시한 음성 사례, 짧지만 새 정보가 있는 대화 등 추가 평가 사례 제안. 기존 정답셋과 분리해 검토한다.
- 저장·나가기·휴지통·질문 재시작 안내의 용어와 이해도 점검.
- 첫 사용자 테스트 질문지와 관찰 항목 작성.
- 발표의 문제·핵심 가설·데모·검증 결과 연결 점검. 측정하지 않은 성과를 만들지 않는다.

## 작업 전달 형식

한 작업에는 아래 정보만 전달한다.

```text
작업 ID:
기준: 저장소 / 브랜치 / 실제 확인한 commit SHA
목표: 이번에 해결할 한 가지
읽을 자료: 관련 절과 필요한 사례 ID만
변경 가능 범위:
고정할 규칙과 미결:
결과: 수정안 + 이유 + 영향 받는 사례 + 남은 질문
실행 여부: 실제 실행 / 문서 검토를 구분
```

반환할 때 문서 전체를 다시 붙이지 말고 변경 부분과 근거를 보낸다. 새 대화에서는 이 작업 묶음과 직전 결과만 전달한다. 같은 파일의 기준 SHA가 달라지면 먼저 차이를 확인한다.

## 토큰과 재작업을 줄이는 순서

1. 관련 문서 절과 사례만 한 번 읽고 기준 SHA를 기록한다.
2. 후보는 우선 하나만 만든다. 여러 버전을 동시에 전면 평가하지 않는다.
3. Codex가 실패 사례·위반 규칙·실제 출력을 짧게 전달한다. 개발용 fixture를 쓰고 실제 사용자 고민 원문은 포함하지 않는다.
4. Claude는 실패 원인과 최소 문구 변경만 반환한다.
5. Codex는 관련 사례부터 재검증하고, 반영 전 전체 회귀 검증을 실행한다.
6. 최종 결과는 STATUS와 해당 제안서에 남긴다. 긴 대화 기록을 매번 전달하지 않는다.

Core와 Safety 결과는 분리한다. 프롬프트 문안을 줄였다는 이유만으로 정확도나 안전 규칙이 좋아졌다고 판단하지 않는다.

## 인증 구현 체크포인트

Google/Kakao OAuth 시작·익명 identity linking·callback·로그아웃은 구현했다. 실제 공급자 설정/왕복, 익명 사용자 생성 및 보관 선택 복귀는 남았다. 설정·검증 범위는 [인증 기록](reviews/2026-09-14-auth-flow.md)을 참고한다. Claude가 프롬프트/제품 규칙을 이 인증 구현에 맞춰 바꿀 필요는 없다.
