# 작업 상태

기준일: 2026-09-11

## STEP 1 — 초기화 / 첫 배포 (완료)

- Next.js 16.3.4 / React 19.3.0 / TypeScript strict / npm
- SEED React, Supabase, OpenAI, Zod 기반 초기화
- 한국어 첫 화면과 `/api/health` 구현
- 운영 주소: `https://nook-nine-eta.vercel.app`
- `/`와 `/api/health` HTTP 200 검증
- `npm run format:check`, `npm run validate`, `npm audit` 통과

---

## STEP 2 — ERD / DB 설계 (설계 완료, 적용 전)

2026-09-11 사용자와 확정한 관계·상태·삭제 규칙을 문서와 Supabase migration으로 옮겼다.

### 확정한 제품 데이터 규칙

- 세션 생성 시점: 첫 Raw Thought 제출
- 대화 상태와 보관 상태 분리
- 생각더미: `COMPLETED + SAVED` 세션 조회
- 휴지통: `COMPLETED + TRASHED`, 7일 복원 후 hard delete
- Branch 질문: `PENDING` 후보 중 사용자가 고른 것만 `KEPT`
- 보관 질문 다회 재시작, 질문 삭제 뒤 재시작 Session 유지
- Segment Anchor는 직전 Segment 마지막 Node 참조, 복제·카운트 금지
- Question Node / Shift Edge append-only, Clarification mutable
- CHECK Event / `check_count` / Pile `RESUMED` 제거
- HANDOFF lifecycle은 `HANDOFF_STOPPED`
- Safety trigger 원문과 전체 분류 입출력 미저장

### 생성한 설계·마이그레이션

- `docs/ERD.md` — 코드 이름의 자연어 뜻, ERD, 컬럼, 상태, 삭제, RLS, 트랜잭션
- `supabase/migrations/202609110001_nook_core_schema.sql` — 타입, 13개 앱 테이블, 증거 연결, FK, 제약, 카운터 트리거
- `supabase/migrations/202609110002_nook_access_and_retention.sql` — RLS, 보관/휴지통/복원 RPC, Branch 삭제, Segment 전환, Safety 종료, 정리 함수, 조회 View
- `supabase/snippets/schedule_retention_cleanup.sql` — 시간당 보존 만료 정리 Cron

### 아직 적용하지 않은 것

- 실제 Supabase 프로젝트 연결과 migration push
- Supabase 로컬 스택에서 migration reset / DB test
- 서버 전용 Supabase secret client와 API 저장 흐름

migration은 저장소에 설계 산출물로 들어가며, 원격 DB에 적용·검증하기 전에는 운영 DB가 만들어졌다고 주장하지 않는다.

---

## 제품 문서 상태

- `docs/PRD.md` v2.2 — 생각더미/휴지통/질문 명시 보관과 DB 상태 반영
- `docs/RULES.md` — EVALSET v4.1 판정 계약 유지 + 보관/Safety lifecycle 동기화
- `docs/EVALSET.md` v4.1 — 평가 계약 유지
- `eval/safety_mapping.json` — 결정론적 Safety 매핑

평가 fixture 필드 `input.pile` / `promote_pile_item`은 v4.1 호환을 위해 유지한다. 제품 DB에는 Pile Item 테이블을 만들지 않고 `branch_questions`를 사용한다.

---

## 아직 구현하지 않은 것

- 익명 인증과 Google/Kakao Identity Linking
- Safety / Judge / Reframe / Reflection 엔진
- 실제 세션/메시지/Node/Branch 저장 API
- 생각더미 / 휴지통 / 남겨둔 질문 UI
- raw `judge/start/safety` JSONL과 실제 eval harness

---

## 다음 단계

1. Supabase 프로젝트를 연결하고 두 migration을 빈 로컬 DB에 적용
2. RLS allow/deny와 7일 삭제·복원·Anchor·cross-owner FK를 DB test로 검증
3. 서버 전용 Supabase secret client를 추가하고 Safety-first 저장 API 구현
4. 익명 로그인 → 종료 → OAuth Identity Linking → 보관 흐름 구현
5. raw eval fixture 입고 후 Safety → Judge → Reframe / Reflection 엔진 구현
