# 작업 상태

기준일: 2026-09-11

## STEP 1 — 초기화 / 첫 배포 (완료)

### 완료한 구현

- Next.js 16.3.4 / React 19.3.0 / TypeScript / npm 초기화
- SEED React 2.4.1 및 CSS 2.7.0 적용
- 한국어 최소 첫 화면·접근 가능한 입력창·모바일 대응 스타일
- OpenAI 7.13.0, Supabase JS 2.116.0 / SSR 0.12.7, Zod 4.6.1 기반
- 서버 전용 키 보호, 환경변수 지연 검증, 공개 키와 서버 키 구분
- 외부 API를 호출하지 않는 `/api/health`
- npm 잠금 파일, Prettier, ESLint, 타입 검사, 빌드 스크립트

### 로컬 검증 결과

| 확인 | 결과 |
|---|---|
| `npm run format:check` | 통과 |
| `npm run validate` | 타입 검사 → 린트 → 빌드 통과 |
| `npm audit` | 알려진 취약점 0건 |
| 프로덕션 서버 `/` | HTTP 200, 한국어 문구·textarea·접근성 레이블 확인 |
| 프로덕션 서버 `/api/health` | HTTP 200 |
| 외부 키 없이 첫 화면 | 빌드·응답 성공 |

### Vercel 검증

운영 배포와 실제 응답을 검증해 STEP 1을 완료했다.

- 운영 주소: `https://nook-nine-eta.vercel.app`
- `/`: HTTP 200, Nook 첫 화면 정상 응답
- `/api/health`: HTTP 200, `status: ok`
- 외부 API 키 없이 첫 화면과 health 응답 성공

기존 로그인 제한 Preview는 현재 운영 주소가 아니므로 완료 판단 기준에서 제외한다.

---

## 제품 문서 상태

현재 문서 구조:

```text
README.md
AGENTS.md
docs/
  STATUS.md
  PRD.md
  RULES.md
  EVALSET.md
```

- `docs/PRD.md` — 제품 범위 / UX Source of Truth
- `docs/RULES.md` — 판정·대화·Safety·보관 실행 규칙 Source of Truth
- `docs/EVALSET.md` — 평가 계약·회귀 기준 Source of Truth
- `docs/ERD.md` — 아직 없음. 사용자와 설계를 확정한 뒤 생성

### PRD / 데이터 계약 최신화

2026-09-11 대화에서 확정된 제품 수준 데이터 규칙을 `docs/PRD.md` v2.1에 반영했다.

- 사용자 승인 전 Question Node 확정 저장 금지
- Question Node/Shift Edge append-only, Clarification mutable
- 이전 Segment 마지막 확정 Node를 Anchor로 참조하고 복제하지 않음
- Segment 카운터를 관련 변경과 같은 트랜잭션에서 갱신
- Session Feedback은 Session당 0~1개
- Pile hard delete 시 재시작 Session 유지 + `origin_branch_id SET NULL`
- Safety trigger 원문·전체 모델 입출력 저장 금지
- 조회·생성·수정·참조 연결 모두 소유권 검증

ERD의 정확한 필드·FK·nullable·상태값·cascade·RLS SQL은 아직 미확정이며 자동 구현하지 않는다.

### RULES / EVALSET 검증

2026-09-11에 사용자 제공 EVALSET v4 패치 노트를 기존 RULES/EVALSET과 대조해 검증하고 RULES를 v4.1 수준으로 고도화했다.

반영된 핵심:

- hedge 계산을 harness 책임으로 명확화
- `hedge_speaker` 면제 범위 확정
- 1턴 명시적 자기 선언 조건 강화
- carryover `medium_reason` 정의
- Clarification 금지어 / HIGH-only 금지어 분리
- invalidate/promote exact 채점 계약
- Safety classifier는 label/category만 출력
- `eval/safety_mapping.json`에서 behavior/contact 결정
- HANDOFF 경계 규칙 보강
- 여러 고민이 섞인 Raw Thought의 임의 중심 선택 금지
- `~것 같아요?`처럼 완화형 답변을 유도하는 질문 억제

### 평가 데이터 상태

사용자 제공 패치의 목표 규모는 **judge 32 · start 17 · safety 15**다.

현재 저장소에 있는 것은:

- `docs/EVALSET.md` — 검증된 사람용 평가 계약
- `eval/safety_mapping.json` — 결정론적 Safety behavior/contact 매핑

아직 저장소에 없는 것:

- `judge.jsonl`
- `start.jsonl`
- `safety.jsonl`
- 실제 eval harness / `npm run eval`

따라서 **평가셋 설계가 검증된 것과 모델 eval이 실행된 것은 구분한다.** raw fixture가 들어오면 `docs/EVALSET.md`의 입고 체크리스트를 통과한 뒤 정답셋으로 사용한다.

---

## 아직 구현하지 않은 것

- AI 모델 호출
- Safety / Judge / Reframe / Reflection 엔진
- ERD / SQL / RLS
- 익명 인증과 OAuth
- Thought Path / Pile / 실제 데이터 저장
- raw eval fixture와 eval harness

현재 입력은 브라우저 입력창에만 존재하며 전송·저장하지 않는다. 실제 API 키나 Supabase 프로젝트 연결은 설정되지 않았다.

---

## 다음 단계

1. **사용자와 ERD의 남은 결정을 마무리** — 정확한 필드·FK·nullable·상태·cascade → RLS → SQL migration 순서
   - HANDOFF lifecycle status
   - CHECK Event 엔티티 최종 삭제 여부
   - 익명 미완료 세션 정리 시점 (24시간 제안값)
2. 확정 내용을 `docs/ERD.md`와 Supabase migration으로 옮기기
3. 사용자 제공 raw `judge/start/safety` JSONL을 저장소에 넣고 EVALSET 입고 검증
4. EVALSET v4.1의 추가 경계 fixture를 보강
   - AI가 A/B 대조를 먼저 연 1턴 자기 선언 음성 케이스
   - hedge 면제 경계
   - `medium_reason` carryover (J-CARRY-03)
   - HANDOFF / 제3자 긴급도 / 초성·은어·철자 변형
   - 긴 입력 / 여러 고민 Raw Thought
5. 평가셋 기준으로 Safety → Judge → Reframe / Reflection 엔진 구현
