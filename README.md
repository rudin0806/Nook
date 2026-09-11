# Nook

답을 주는 대신, 내가 어떤 질문을 지나왔는지.
Nook은 감정을 분석하거나 치료하는 서비스가 아니라, 정보로 풀리지 않는 질문을 다룹니다.
Nook은 현재의 중심 질문을 찾고, 사용자가 확정한 질문의 이동 경로를 남기는 개인 사고 도구입니다.

## 현재 단계

STEP 1 — 프로젝트 초기화 및 첫 배포 준비.

- Next.js App Router / React / TypeScript strict / npm
- SEED React를 사용한 한국어 첫 화면과 입력창
- 서버 전용 OpenAI 클라이언트, Supabase 브라우저·Route Handler 클라이언트 팩토리
- 환경변수 지연 검증: 키 없이 첫 화면 빌드 가능
- 외부 API를 호출하지 않는 `GET /api/health`
- Prettier, ESLint, 타입 검사, 프로덕션 빌드

현재 입력은 전송·저장되지 않습니다. AI 응답, 인증, DB 테이블, Thought Path, eval은 다음 단계입니다.
SDK 기반 준비는 실제 계정 연결이나 API 호출 성공을 의미하지 않습니다.
배포 상태와 검증 결과는 `docs/STATUS.md`를 확인합니다.

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
4. STEP 1은 키 없이 배포할 수 있습니다. 실제 연결 단계에서 필요한 환경변수를 해당 배포 환경에 등록합니다.
5. 배포 완료 후 `/`의 한국어 첫 화면과 `/api/health`의 HTTP 200을 확인합니다.

검색 제외 메타데이터는 접근 통제가 아닙니다. 개인정보를 다루는 실제 기능 공개 전 인증·RLS를 검증합니다.

## 문서

- `AGENTS.md`: 개발 에이전트용 구현 규칙과 문서 참조 순서
- `RULES.md`: AI 판정·대화 톤·보관/노출·Safety 등 제품 행동 규칙의 기준 문서
- `docs/PRD.md`: 제품 정의·범위·데이터 구조 원칙
- `docs/HANDOFF.md`: 구현 인수인계
- `docs/DECISIONS.md`: 충돌 검토·구현 해석·미결
- `docs/STATUS.md`: 완료 범위·검증·배포 상태

제품 행동 규칙은 `AGENTS.md`나 README에 중복해서 유지하지 않고 `RULES.md`를 기준으로 봅니다.
