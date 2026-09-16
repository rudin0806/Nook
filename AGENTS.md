# Nook Development Rules

## Source of truth

문서는 역할별로 나눈다. 같은 규칙을 여러 파일에 중복해서 유지하지 않는다.

- 프로젝트 소개·실행법·문서 지도: `README.md`
- 현재 진행 상태·다음 작업: `docs/STATUS.md`
- 제품 정의·범위·핵심 UX: `docs/PRD.md`
- AI 판정·대화·보관·Safety 규칙: `docs/RULES.md`
- 평가 계약·회귀 기준: `docs/EVALSET.md`

### 문서 읽기 순서

작업 시작 전 필요한 범위까지만 아래 순서로 읽는다.

1. `README.md`
2. `docs/STATUS.md`
3. `docs/PRD.md`
4. AI/대화/판정 작업이면 `docs/RULES.md`
5. eval 작업이면 `docs/EVALSET.md`

**제품 규칙을 `AGENTS.md`에 중복해서 적지 않는다.** 판정·대화·보관·화면 동작이 바뀌면 먼저 `docs/RULES.md`와 필요한 경우 `docs/PRD.md`를 수정한다.

문서끼리 충돌하면 임의로 해석해 구현하지 않는다. `docs/PRD.md`는 제품 범위, `docs/RULES.md`는 실행 규칙, `docs/EVALSET.md`는 평가 계약의 기준으로 본다. 그래도 충돌하면 사용자 확인 후 수정한다.

## Current stage

- 현재 단계는 `docs/STATUS.md`를 기준으로 한다.
- STEP 2의 관계·상태·삭제 규칙은 사용자와 검토를 마치고 `docs/ERD.md`와 `supabase/migrations/`에 옮겼다. 이후 DB 작업은 `docs/ERD.md`를 먼저 읽고, 제품 의미를 바꾸는 스키마 수정은 `docs/PRD.md`/`docs/RULES.md`와 함께 갱신한다.
- 실제 기능 없이 성공하는 척하는 API, 저장, AI 응답, eval을 만들지 않는다.
- `docs/EVALSET.md`가 존재하더라도 실제 raw JSONL fixture와 eval harness가 구현되기 전에는 `npm run eval` 통과를 주장하지 않는다.

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

- Safety Gate는 일반 대화 엔진보다 먼저 실행한다. 세부 판정은 `docs/RULES.md`를 따른다.
- Safety classifier는 label/category만 출력하고 behavior/contact는 결정론적 mapping에서 처리한다.
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

Judge / Reframe / Reflection / Safety 엔진을 수정했고 실제 평가기와 raw fixture가 준비된 이후에는:

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

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
