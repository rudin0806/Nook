# Nook Development Rules

## Source of truth

- 제품 정의와 범위: `docs/PRD.md`
- AI 판정·대화·화면 행동 규칙: `RULES.md`
- 테스트 케이스와 기대값: `docs/EVALSET.md`
- 구현 인수인계: `docs/HANDOFF.md`
- 문서 충돌·새 결정: `docs/DECISIONS.md`
- 진행 상태: `docs/STATUS.md`

**제품 규칙을 `AGENTS.md`에 중복해서 적지 않는다.** 판정·대화·보관·화면 동작이 바뀌면 먼저 `RULES.md`와 필요한 경우 `docs/PRD.md`를 수정한다. 문서가 충돌하면 임의로 구현하지 말고 `docs/DECISIONS.md`에 남긴다.

## Current stage

- 현재 단계는 STEP 1: 초기화, 최소 첫 화면, SDK 기반, 검증, Vercel 첫 배포.
- 이 단계에서 AI Judge, 프롬프트, ERD, 인증 기능을 선행 구현하지 않는다.
- STEP 2 ERD는 자동 구현하지 않는다. 사용자와 관계·상태·삭제 규칙을 검토해 확정한 뒤 Supabase 스키마로 옮긴다.
- 실제 기능 없이 성공하는 척하는 API, 저장, AI 응답, eval을 만들지 않는다.

## Stack

- TypeScript
- Next.js App Router
- React
- SEED React
- Supabase
- OpenAI
- Zod
- npm only

## Architecture

- UI와 비즈니스 로직을 분리한다.
- OpenAI/Supabase 호출을 React 컴포넌트 안에서 직접 하지 않는다.
- AI 엔진 로직은 `src/engine/`에 둔다.
- 프롬프트는 `src/prompts/`에 둔다.
- Zod schema는 `src/schemas/`에 둔다.
- API는 `src/app/api/`에서 처리한다.
- 기본적으로 Server Component를 사용하고 필요한 경우에만 `"use client"`를 사용한다.
- 별도 백엔드 서버를 만들지 않는다.

## Data and AI implementation guardrails

- Safety Gate는 일반 대화 엔진보다 먼저 실행한다. 세부 판정은 `RULES.md`를 따른다.
- Judge 응답은 반드시 Zod로 검증하고, 검증되지 않은 결과를 저장하지 않는다.
- Main Node는 사용자 확인 전 확정 기록으로 취급하지 않는다.
- Question Node는 historical/append-only, Clarification은 mutable이라는 구분을 유지한다.
- `node_count`, `turn_count`, `branch_count`는 Segment 범위다.
- 실제 API 키와 `.env.local`은 커밋하지 않는다. `.env.example`에는 빈 값만 둔다.
- OpenAI는 서버 전용 모듈에서 호출한다. Supabase의 공개 키와 비밀 키를 구분한다.

## Code Quality

- TypeScript strict typing을 유지한다.
- 의미 있는 변수명과 컴포넌트명을 사용한다.
- 거대한 `page.tsx`를 만들지 않는다.
- 중복 로직은 함수/컴포넌트로 분리한다.
- 불필요한 div 중첩과 inline style을 피한다.
- semantic HTML을 사용한다.
- 클릭 동작을 불필요하게 div에 구현하지 않는다.
- 새 라이브러리는 명확한 필요가 있을 때만 추가한다.
- 기능이 동작한다는 이유만으로 임시 코드를 방치하지 않는다.

## Validation

작업 완료 전 반드시 실행:

- `npm run typecheck`
- `npm run lint`
- `npm run build`

가능하면 `npm run validate`로 통합한다.

Judge / Reframe / Reflection / Safety 엔진을 수정했다면 실제 평가기가 준비된 이후:

- `npm run eval`

을 추가로 실행한다.

타입 오류, lint 오류, build 오류를 남긴 상태로 작업 완료했다고 하지 않는다.

## Refactoring

기능 구현 후 반드시:

1. 중복 제거
2. 의미 있는 이름으로 정리
3. 컴포넌트/함수 책임 분리
4. 불필요한 코드 제거
5. formatting
6. validation

을 거친다.
