# Nook

답을 주는 대신, 내가 어떤 질문을 지나왔는지.
Nook은 감정을 분석하거나 치료하는 서비스가 아니라, 정보로 풀리지 않는 질문을 다룹니다.
Nook은 현재의 중심 질문을 찾고, 사용자가 확정한 질문의 이동 경로를 남기는 개인 사고 도구입니다.

## 현재 단계

진행 상태와 다음 작업은 [`docs/STATUS.md`](docs/STATUS.md)를 기준으로 확인합니다.

현재 저장소는 Next.js App Router / React / TypeScript strict / npm 기반이며, SEED React·Supabase·OpenAI·Zod를 사용합니다.

## 실행

Node.js 24.x와 npm을 사용합니다.

```bash
npm ci
npm run dev
```

브라우저에서 http://localhost:3000 을 엽니다.

## 환경변수

첫 화면과 `/api/health`에는 키가 필요하지 않습니다.
실제 기능 연결 단계에서 `.env.example`을 `.env.local`로 복사한 뒤 설정합니다.

| 이름                                   | 공개 범위          | 용도                                    |
| -------------------------------------- | ------------------ | --------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | 브라우저 공개 가능 | Supabase 프로젝트 URL                   |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 브라우저 공개 가능 | Supabase publishable key. RLS 적용 필수 |
| `OPENAI_API_KEY`                       | 서버 전용          | OpenAI API 인증                         |

실제 키를 채팅, PR, 소스 코드에 넣지 않습니다. Supabase secret/service-role key를 `NEXT_PUBLIC_` 변수에 넣지 않습니다.
SDK 사용 시 설정이 없거나 유효하지 않으면 값 자체를 출력하지 않는 오류를 발생시킵니다.
데이터 접근 전 RLS, 익명 인증, OAuth 연결·기존 계정 예외·세션 갱신을 구현해야 합니다.
모델 호출 전 Safety Gate, 입력 제한, 요청량 제한, 비용 설정과 평가기를 준비해야 합니다.

## 검증

```bash
npm run format:check
npm run validate
```

`validate`는 `typecheck` → `lint` → `build` 순서입니다.
`typecheck`는 깨끗한 체크아웃에서도 동작하도록 Next.js 라우트 타입 생성 후 TypeScript를 검사합니다.

`npm run eval`은 실제 평가기 및 테스트셋을 도입하는 엔진 단계에서 추가합니다. 현재 통과를 가장하는 스크립트는 없습니다.

## Vercel 배포

1. Vercel에서 이 비공개 GitHub 저장소를 Import합니다.
2. Framework Preset은 Next.js, Root Directory는 저장소 루트, Node.js는 24.x를 사용합니다.
3. Install Command: `npm ci`, Build Command: `npm run build`. Output Directory는 Next.js 기본값을 유지합니다.
4. 실제 연결 단계에서 필요한 환경변수를 해당 배포 환경에 등록합니다.
5. 배포 완료 후 `/`의 한국어 첫 화면과 `/api/health`의 HTTP 200을 확인합니다.

검색 제외 메타데이터는 접근 통제가 아닙니다. 개인정보를 다루는 실제 기능 공개 전 인증·RLS를 검증합니다.

## 문서 구조

루트에는 **사람과 개발 에이전트가 처음 읽어야 하는 문서만** 둡니다.

- [`README.md`](README.md): 프로젝트 소개·실행·개발 진입점
- [`AGENTS.md`](AGENTS.md): Codex/AI 개발 도구가 지켜야 할 구현 규칙과 문서 읽기 순서

제품 문서는 `docs/`에 모읍니다.

- [`docs/README.md`](docs/README.md): 문서 지도와 읽기 순서
- [`docs/STATUS.md`](docs/STATUS.md): 현재 완료 범위·검증·다음 작업
- [`docs/PRD.md`](docs/PRD.md): 제품 정의·범위·핵심 UX·데이터 구조 원칙
- [`docs/RULES.md`](docs/RULES.md): AI 판정·대화 톤·보관/노출·Safety 규칙
- `docs/EVALSET.md`: 평가 케이스와 기대값 — 검증 완료 후 추가

**같은 규칙을 README·AGENTS·PRD·RULES에 중복해서 유지하지 않습니다.** 제품 범위는 PRD, 실행 규칙은 RULES, 현재 상태는 STATUS를 기준으로 봅니다.
