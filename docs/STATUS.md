# 작업 상태

기준일: 2026-09-12

## STEP 1 — 초기화 / 첫 배포 (완료)

- Next.js 16.3.4 / React 19.3.0 / TypeScript strict / npm
- SEED React, Supabase, OpenAI, Zod 기반 초기화
- 한국어 첫 화면과 `/api/health` 구현
- 운영 주소: `https://nook-nine-eta.vercel.app`
- `/`와 `/api/health` HTTP 200 검증
- `npm run format:check`, `npm run validate`, `npm audit` 통과

---

## STEP 2 — ERD / DB 설계·적용 (완료)

사용자와 확정한 관계·상태·삭제 규칙을 문서와 Supabase migration으로 옮기고, NOOK Supabase 프로젝트에 적용했다.

### 확정한 제품 데이터 규칙

- 세션 생성 시점: 첫 Raw Thought 제출
- 대화 상태와 보관 상태 분리
- 생각더미: `COMPLETED + SAVED` 세션 조회
- 휴지통: 계정 연결 사용자의 `COMPLETED + TRASHED`, 7일 복원 후 hard delete
- 익명 사용자가 아무것도 보관하지 않으면 `TRASHED` 없이 즉시 hard delete
- 익명 사용자가 세션 또는 Branch 질문을 보관하면 먼저 OAuth identity linking
- Branch 질문: `PENDING` 후보 중 사용자가 고른 것만 `KEPT`
- 보관 질문 다회 재시작, 질문 삭제 뒤 재시작 Session 유지
- Segment Anchor는 직전 Segment 마지막 Node 참조, 복제·카운트 금지
- Question Node / Shift Edge append-only, Clarification mutable
- CHECK Event / `check_count` / Pile `RESUMED` 제거
- HANDOFF 발화는 Message로 저장하고 `HANDOFF_STOPPED`; STOP 위험 원문은 미저장
- Safety classifier는 `label + category`만 출력하고 behavior/contact는 결정론적 매핑

### 적용한 migration

1. `202609110001_nook_core_schema.sql`
2. `202609110002_nook_access_and_retention.sql`
3. `20260912001339_fix_temporary_expiry_nullable.sql`
4. `20260912011744_harden_retention_rls_and_indexes.sql`

세 번째 migration은 `SAVED/TRASHED` 전환 시 `temporary_expires_at = NULL`을 허용한다. 네 번째 migration은 익명 즉시 폐기, 보관 전 identity 연결 강제, RLS 정책 최적화, 자동 RLS helper 실행 권한 회수, 복합 FK 인덱스를 반영한다.

### 실제 DB 검증

- public 앱 테이블 13개 모두 RLS 활성화
- 사용자 A가 자기 Session/Branch/Evidence만 조회하고 사용자 B 행은 0건으로 숨겨짐
- 다른 사용자 세션에 보관 RPC를 호출하면 `SESSION_NOT_FOUND`
- 익명 `남기지 않고 나가기`는 즉시 삭제되고 RPC 결과는 `NULL`
- 익명 보관 요청은 `IDENTITY_LINK_REQUIRED`
- 계정 연결 사용자의 저장은 `SAVED + temporary_expires_at NULL`
- 계정 연결 사용자의 미보관은 `TRASHED + 정확히 7일`
- `judge_logs` / `safety_events`는 클라이언트 SELECT 권한 없음
- Supabase 자동 RLS helper는 `anon/authenticated` 실행 불가
- 테스트용 사용자·세션·질문 행은 모두 제거됨

### Advisor 검토

- Security Advisor의 익명 실행 가능 함수, 정책 없는 RLS 테이블 경고는 해결
- 남은 Security 경고 9건은 소유권을 내부에서 재검사하는 사용자용 `SECURITY DEFINER` RPC이며 의도된 공개 범위
- Performance Advisor의 미인덱싱 FK와 `auth.uid()` init-plan 경고는 해결
- 남은 항목은 데이터가 아직 없는 새 인덱스의 `unused_index` 정보뿐이며 지금 삭제하지 않음

로컬 Supabase stack의 `migration reset`은 아직 실행하지 않았다. 원격 프로젝트 적용과 실제 SQL/RLS 검증을 완료한 상태다.

---

## 제품·평가 문서 상태

- `docs/PRD.md` v2.3 — 홈 `지나온 생각` 표기, 익명 즉시 폐기, HANDOFF Message 저장 반영
- `docs/RULES.md` v3 저장소 확장본 — 첨부 원본과 일부 계약 충돌. 전체 동기화 완료가 아님
- `docs/EVALSET.md` v4.1 — 채점·리포트 계약과 우선 경계쌍
- `eval/safety_mapping.json` — 결정론적 Safety 매핑
- 사용자 제공 원본 4개 입고 완료. RULES 원본은 `docs/references/RULES-v3-upload.md`, JSONL 작업본은 `eval/`에 있음
- `npm run eval:validate` 추가: 64개 구조·ID·패치·완화형 통제쌍 검사. 실제 모델은 호출하지 않음
- 확인된 v4 패치 누락 수정. carryover 2개·Safety 분류 8개의 저장소 계약 불일치는 남아 있어 전체 검증은 실패 상태
- [문서별 검증 기록](reviews/2026-09-12-document-validation.md)에 원본 해시, 수정 내용, 미결과 실행 결과 기록

평가 fixture 필드 `input.pile` / `promote_pile_item`은 v4.1 호환을 위해 유지한다. 제품 DB에는 Pile Item 테이블을 만들지 않고 `branch_questions`를 사용한다.

---

## 아직 구현하지 않은 것

- 익명 인증과 Google/Kakao Identity Linking UI/API
- Safety / Judge / Reframe / Reflection 엔진
- 실제 세션/메시지/Node/Branch 저장 API
- 생각더미 / 휴지통 / 남겨둔 질문 UI
- 실제 모델을 호출·채점하는 eval harness (`npm run eval`)
- 로컬 Supabase migration reset 기반 재현 테스트

원본 JSONL은 수신해 보존했다. 라벨을 임의로 바꾸거나 없는 회귀 케이스를 정답 데이터인 것처럼 채우지 않는다.

---

## 다음 단계

1. 검증 기록의 HANDOFF 상태·Safety 분류명·carryover 확장 계약 확인 및 fixture 호환성 해결
2. 서버 전용 Supabase secret client와 Safety-first 저장 API 구현
3. 익명 로그인 → 종료 → 필요 시 OAuth Identity Linking → 보관/즉시 폐기 흐름 구현
4. Safety → Judge → Reframe / Reflection 엔진과 실제 eval harness 구현
5. 생각더미·휴지통·남겨둔 질문 UI 연결
