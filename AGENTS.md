# Nook Development Rules

## Source of truth and current stage

- 제품 기준: `docs/PRD.md`, 구현 인수인계: `docs/HANDOFF.md`.
- 문서 충돌과 해석은 `docs/DECISIONS.md`에 기록한다. 미결을 임의로 구현하지 않는다.
- 현재 단계는 STEP 1: 초기화, 최소 첫 화면, SDK 기반, 검증, Vercel 첫 배포.
- 이 단계에서 AI Judge, 프롬프트, ERD, 인증 기능을 선행 구현하지 않는다.
- `.env.local` 및 실제 API 키는 커밋하지 않는다. `.env.example`에는 빈 값만 둔다.
- OpenAI는 서버 전용 모듈에서 호출한다. Supabase의 공개 키와 비밀 키를 구분한다.
- 실제 기능 없이 성공하는 척하는 API, 저장, AI 응답, eval을 만들지 않는다.

## Stack

- TypeScript
- Next.js App Router
- React
- SEED React
- Supabase
- OpenAI
- npm only

## Architecture

- UI와 비즈니스 로직을 분리한다.
- OpenAI/Supabase 호출을 React 컴포넌트 안에서 직접 하지 않는다.
- AI 엔진 로직은 `src/engine/`에 둔다.
- 프롬프트는 `src/prompts/`에 둔다.
- Zod schema는 `src/schemas/`에 둔다.
- API는 `src/app/api/`에서 처리한다.

## Code Quality

- TypeScript strict typing을 유지한다.
- 의미 있는 변수명과 컴포넌트명을 사용한다.
- 거대한 page.tsx를 만들지 않는다.
- 중복 로직은 함수/컴포넌트로 분리한다.
- 불필요한 div 중첩과 inline style을 피한다.
- semantic HTML을 사용한다.
- 기본적으로 Server Component를 사용하고 필요한 경우에만 `"use client"`를 사용한다.
- 새 라이브러리는 명확한 필요가 있을 때만 추가한다.

## Nook-specific

- Node / Clarification / Shift / Branch 개념을 섞지 않는다.
- AI가 사용자가 말하지 않은 심리적 원인이나 성향을 만들어내지 않는다.
- Judge는 판정만 하고 Reframe 문장을 생성하지 않는다.
- Safety는 Judge보다 먼저 실행되는 별도 gate다.
- Main Node는 사용자 확인 전 DB에 확정 저장하지 않는다.
- Question Node는 historical/append-only, Clarification은 mutable이다.

## Validation

작업 완료 전 반드시 실행:

- `npm run typecheck`
- `npm run lint`
- `npm run build`

가능하면 `npm run validate`로 통합한다.

Judge / Reframe / Reflection / Safety 엔진을 수정했다면:

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
