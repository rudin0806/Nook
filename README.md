# Nook

답을 주는 대신, 내가 어떤 질문을 지나왔는지.
Nook은 감정을 분석하거나 치료하는 서비스가 아니라, 정보로 풀리지 않는 질문을 다룹니다.
Nook은 현재의 중심 질문을 찾고, 사용자가 확정한 질문의 이동 경로를 남기는 개인 사고 도구입니다.

## 현재 단계

진행 상태와 다음 작업은 [`docs/STATUS.md`](docs/STATUS.md)를 기준으로 확인합니다.

Codex·Claude 병행 작업의 역할과 전달 형식은 [`docs/HANDOFF.md`](docs/HANDOFF.md)를 참고합니다.

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

| 이름                                   | 공개 범위          | 용도                                                                          |
| -------------------------------------- | ------------------ | ----------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | 브라우저 공개 가능 | Supabase 프로젝트 URL                                                         |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 브라우저 공개 가능 | Supabase publishable key. RLS 적용 필수                                       |
| `SUPABASE_SECRET_KEY`                  | 서버 전용          | 검증된 메시지·AI 기록 저장. RLS 우회 키이므로 사용자 소유권을 서버에서 재검증 |
| `OPENAI_API_KEY`                       | 서버 전용          | OpenAI API 인증                                                               |

실제 키를 채팅, PR, 소스 코드에 넣지 않습니다. Supabase secret key를 `NEXT_PUBLIC_` 변수에 넣지 않습니다.
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

[`docs/EVALSET.md`](docs/EVALSET.md)는 평가 계약을 정의합니다. 사용자 제공 JSONL은 `eval/`에 있으며 `npm run eval:validate`로 구조·참조·패치·현재 매핑 호환성을 검사합니다. 확인된 계약 충돌이 남아 있으면 이 명령은 실패로 종료합니다. 실제 모델을 호출하는 `npm run eval`은 아직 구현하지 않았습니다. [파일별 검증 기록](docs/reviews/2026-09-12-document-validation.md)에서 범위와 미해결 항목을 확인합니다.

## Vercel 배포

1. Vercel에서 이 비공개 GitHub 저장소를 Import합니다.
2. Framework Preset은 Next.js, Root Directory는 저장소 루트, Node.js는 24.x를 사용합니다.
3. Install Command: `npm ci`, Build Command: `npm run build`. Output Directory는 Next.js 기본값을 유지합니다.
4. 실제 연결 단계에서 필요한 환경변수를 해당 배포 환경에 등록합니다.
5. 배포 완료 후 `/`의 한국어 첫 화면과 `/api/health`의 HTTP 200을 확인합니다.

검색 제외 메타데이터는 접근 통제가 아닙니다. 개인정보를 다루는 실제 기능 공개 전 인증·RLS를 검증합니다.

## 문서 구조

루트에는 **진입점 문서만** 둡니다.

- `README.md` — 사람이 처음 보는 프로젝트 안내, 실행법, 문서 지도
- [`AGENTS.md`](AGENTS.md) — Codex/AI 개발 도구가 지켜야 할 구현 규칙

제품 문서는 `docs/`에 모읍니다.

| 문서                                 | 역할                                      | 언제 읽나                                |
| ------------------------------------ | ----------------------------------------- | ---------------------------------------- |
| [`docs/STATUS.md`](docs/STATUS.md)   | 현재 완료 범위, 검증 상태, 다음 작업      | 작업 시작 시 가장 먼저                   |
| [`docs/PRD.md`](docs/PRD.md)         | 무엇을 왜 만드는지, MVP 범위와 핵심 UX    | 기능·데이터 구조를 결정할 때             |
| [`docs/RULES.md`](docs/RULES.md)     | AI가 어떻게 판정하고 무엇을 말해야 하는지 | Judge, Prompt, Safety, 보관 로직 작업 시 |
| [`docs/EVALSET.md`](docs/EVALSET.md) | 평가 계약·회귀 기준·fixture 검증 규칙     | 프롬프트/eval 구현 및 회귀 검증 시       |
| [`docs/ERD.md`](docs/ERD.md)         | 확정된 데이터 모델·상태·삭제·RLS          | DB와 저장 흐름을 구현할 때               |

### 권장 읽기 순서

**일반 개발 작업**

1. `README.md`
2. `docs/STATUS.md`
3. 필요한 경우 `docs/PRD.md`

**AI 엔진·대화 작업**

1. `AGENTS.md`
2. `docs/STATUS.md`
3. `docs/PRD.md`
4. `docs/RULES.md`
5. `docs/EVALSET.md`

**ERD·DB 작업**

1. `docs/STATUS.md`
2. `docs/PRD.md`
3. `docs/RULES.md`의 저장·상태·Safety 관련 규칙
4. [`docs/ERD.md`](docs/ERD.md)에서 관계·상태·삭제·RLS 확인
5. `supabase/migrations/` 순서대로 적용

### Source of truth

- 제품 범위와 UX 의도 → `docs/PRD.md`
- AI 실행 규칙 → `docs/RULES.md`
- 현재 구현 상태 → `docs/STATUS.md`
- 평가 계약과 회귀 기준 → `docs/EVALSET.md`

**같은 규칙을 README·AGENTS·PRD·RULES에 중복해서 유지하지 않습니다.** 한 규칙이 바뀌면 그 규칙의 기준 문서 한 곳을 수정하고, 다른 문서에는 링크나 짧은 요약만 둡니다.

빈 문서나 미래 계획용 파일은 미리 만들지 않습니다.
