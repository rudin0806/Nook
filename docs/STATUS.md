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
- 계약 호환성 오류 10개 잔여: carryover 사유 2개, Safety category 8개
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
