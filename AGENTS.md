# Nook Development Rules

## Product Rules

* Nook은 감정을 다루는 서비스가 아니다. 정보로 풀리지 않는 질문을 다룬다. 정보 검색, 상품 추천, 감정 케어 기능을 만들지 않는다.
* AI는 답을 대신 내리지 않는다. 조언, 결론, 추천을 생성하지 않는다.
* 사용자가 여러 번 말한 것을 하나로 묶는 것은 허용한다. 사용자가 말하지 않은 원인, 성향, 심리적 해석을 추가하지 않는다.
* 이 규칙은 Node뿐 아니라 Clarification, 안내 문구, 종료 화면, Safety 문구 등 서비스의 모든 텍스트에 적용된다.
* 시스템은 사용자를 평가하지 않는다. "많이 생각했어요", "이건 고민할 일이 아니에요" 같은 표현을 쓰지 않는다.
* 판정이 애매하면 아무것도 생성하지 않는다. False Positive Shift가 가장 큰 오류다.
* AI는 멈춰도 되는 순간을 제안하지만, 멈출지는 사용자가 결정한다. Safety만 예외다.

## Engine Rules

* Safety Gate는 대화 엔진보다 먼저 실행되는 별도 gate다. Judge 안에 안전 판정을 넣지 않는다.
* Judge는 판정만 한다. Reframe 문장이나 근거 문장을 생성하지 않는다.
* Structural Check(노드, 턴, Branch 개수)는 코드가 판단한다. LLM에게 세게 하지 않는다.
* 판정 단위는 단일 발화가 아니라 최근 3~4턴의 흐름이다.
* 카운터 위치를 지킨다. node_count, turn_count, branch_count는 Segment에 둔다. check_count는 Session에 둔다.
* Judge 응답은 반드시 Zod로 검증한다. 검증 없이 저장하지 않는다.
* Main Node는 사용자 확인 전 DB에 확정 저장하지 않는다.
* Question Node는 append-only, Clarification은 mutable이다.
* Node, Clarification, Shift, Branch 개념을 섞지 않는다.

## UI Rules

* 대화량을 진행처럼 표현하지 않는다. 턴마다 점을 찍지 않는다.
* 진행률 표현을 쓰지 않는다. 2/4, 50% 등. 4는 시스템 상한이지 사용자 목표가 아니다.
* 아무것도 선명해지지 않았으면 화면에 아무것도 추가하지 않는다. 가짜 진행 애니메이션을 넣지 않는다.
* 따라가지 않은 질문은 존재만 알리고 내용은 접어둔다.
* 쌓인 양이 아니라 쌓인 내용을 보여준다. 질문 개수나 연속 일수를 표시하지 않는다.

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
