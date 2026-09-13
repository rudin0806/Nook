# 작업 상태

기준일: 2026-09-12

## STEP 1 — 초기화 / 첫 배포 (완료)

- Next.js 16.3.4 / React 19.3.0 / TypeScript strict / npm
- SEED React, Supabase, OpenAI, Zod 기반 초기화
- 한국어 첫 화면과 `/api/health` 구현
- 운영 주소: `https://nook-nine-eta.vercel.app`
- 초기 배포에서 HTTP 200·format·validate·audit 검증 기록 있음

## 확정된 문서와 구현 상태

- PRD v2.3: 홈 `지나온 생각`, 익명 미보관 즉시 폐기, HANDOFF Message 저장을 반영했다.
- RULES와 ERD의 같은 저장 규칙도 함께 정리했다.
- 상태는 기존 main의 `HANDOFF_STOPPED`를 유지했다. 첨부 원본의 `COMPLETED`로 변경한 것이 아니다.
- 이번 변경은 문서다. 저장 API·인증 화면·AI 엔진을 구현하거나 운영 배포를 검증했다는 뜻이 아니다.

## STEP 2 — DB 설계 / 후속 보완 검토

main에는 초기 migration 2개와 ERD가 있다. [PR #2](https://github.com/rudin0806/Nook/pull/2)에 원격 DB 적용·RLS 테스트 기록 및 후속 migration 2개가 있다. 이번 문서 작업에서 원격 DB를 다시 조회하거나 적용하지 않았다.

- 원격 이력과 main의 migration 파일 개수는 같다고 가정하지 않는다.
- 후속 보완을 병합하기 전에 원격 이력·파일·재현 검증을 맞춘다.
- 이미 적용된 migration을 이름만 바꿔 다시 적용하지 않는다.
- 로컬 Supabase reset 기반 재현 테스트와 실제 저장 API는 아직 남아 있다.

## 평가 파일

원본 RULES·Judge 32·Start 17·Safety 15는 PR #2에 보존돼 있다. main에는 아직 JSONL과 정적 검증 스크립트를 합치지 않았다.

[파일별 검증 기록](https://github.com/rudin0806/Nook/blob/8cfb144a69d30352d429207992f9cd411f855a43/docs/reviews/2026-09-12-document-validation.md):

- 패치 누락으로 발생한 정적 검사 오류 8개 수정
- C-03-pre 반영 후 계약 호환성 오류 8개 잔여: Safety category 8개
- 별도로 HANDOFF 상태·문구 및 확장 규칙 차이 검토 필요
- 실제 모델 평가기와 실제 모델 정확도는 아직 없음

## 다음 개발 순서

1. 원본과 저장소의 계약 차이를 검토하고 필요한 제품 결정을 확정한다.
2. PR #2의 DB 보완·평가 파일을 분리 검증해 순차 병합한다.
3. 서버 입출력 스키마와 평가기를 구현한다.
4. 인증·소유권 검증과 Safety-first 저장 API를 연결한다.
5. 프롬프트 초안으로 실제 평가 → 오답 수정 → 세션 UI 연결을 진행한다.

병행 작업의 역할·첫 과제·전달 형식은 [HANDOFF.md](HANDOFF.md)를 따른다. Codex는 개발·평가 실행·통합, Claude는 프롬프트·분석 제안을 담당한다.

## 이번 문서 변경 검증

확정된 PRD·RULES·ERD의 저장 규칙과 문서 링크를 교차 확인한다. 코드 검사 결과는 문서 PR의 검증란에 기록한다.

## 개발 체크포인트 — 완화형 계산기

공통 완화형 비율 계산기와 경계 테스트를 PR #2에 추가했다. 실제 저장 API와 LLM 호출에는 아직 연결하지 않았다. 재개 순서와 미결은 [CHECKPOINT.md](CHECKPOINT.md)를 먼저 확인한다.

## C-03-pre 구현

Prompt B 확정본, Judge Zod 출력 검증, 결정론적 채점기, 공통 hedge 계산기 통합. 상세와 다음 작업은 [CHECKPOINT.md](CHECKPOINT.md), 평가 범위는 [EVALSET.md](EVALSET.md)를 따른다. 실제 모델 호출은 아직 없다.

## C-02 수령·통합 — 2026-09-13

Prompt D 및 REFLECT 전용 요청 준비/출력 검증 코드를 추가했다. medium_reason 전달, PAST 상한, 증거 ID 확인 테스트 8개와 타입·린트·빌드 통과. 원본·검토 내용은 [C-02 통합 기록](reviews/2026-09-13-C-02-integration.md)을 따른다. 실제 모델/API/DB 배선과 focus_required 담당 결정은 남아 있다.

별도 DB 작업은 PR #4/#5가 main에 병합됐고 #5의 운영 적용·삭제/RLS 회귀도 완료됐다. 이 AI 브랜치는 해당 main과 아직 동기화하지 않았으며 PR 전체 병합 전 충돌 정리가 필요하다. 자동 삭제 예약은 가동하지 않았다.

## Judge 모델 runner — 2026-09-13

Responses API → Judge Zod 검증 → 결정론적 채점 연결을 구현했다. 기본 두 사례, 요청 수·출력 토큰 상한, API 오류 시 중단, 원문 없는 보고서를 제공한다. 단위 테스트 7개와 dry-run/타입/린트/빌드 통과. 실행 환경에 API 키·평가 모델이 없어 실제 호출은 미실행이다. [설정과 제한](reviews/2026-09-13-judge-model-runner.md). PR #2의 main 동기화 및 병합은 별도다.
