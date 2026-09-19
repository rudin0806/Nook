# Nook

> 복잡한 생각, 말하면서 정리해요.

Nook은 복잡한 생각을 대화로 풀어놓고, 지금 무엇을 고민하고 있는지와 생각이 어떻게
바뀌었는지를 정리해 남기는 서비스다. 사용자가 처음부터 질문을 잘 정리해서 입력할
필요는 없다.

감정을 분석하거나 치료하는 서비스가 아니라, 정보로 풀리지 않는 질문을 다룹니다.
답을 대신 내리지 않고, 사용자가 확정한 질문의 이동 경로를 남긴다.

제품 정의·문제·가설·범위는 [`docs/PRD.md`](docs/PRD.md)를 기준으로 한다.

## 현재 단계

운영 주소는 [Nook](https://nook-nine-eta.vercel.app/)다. 현재 운영 기준은 `main`이며 main에 push하면 Vercel Git 연동으로 자동 배포된다. 함수 리전은 `vercel.json`이 `icn1`(서울)로 고정한다 — Supabase가 `ap-northeast-2`라 DB 왕복을 같은 리전에서 끝내기 위한 설정이며, Hobby 플랜은 리전 하나만 허용한다. 배포·GitHub 구현·검증 상태를 구분한 진행 상태와 다음 작업은 [`docs/STATUS.md`](docs/STATUS.md)를 기준으로 확인한다.

Codex·Claude 병행 작업의 역할과 전달 형식은 [`docs/HANDOFF.md`](docs/HANDOFF.md)를 참고한다.

현재 저장소는 Next.js App Router / React / TypeScript strict / npm 기반이며, SEED React·Supabase·OpenAI·Zod를 사용한다.

## 실행

Node.js 24.x와 npm을 사용한다.

```bash
npm ci
npm run dev
```

브라우저에서 http://localhost:3000 을 연다.

## 환경변수

첫 화면과 `/api/health`에는 키가 필요하지 않다.
실제 기능 연결 단계에서 `.env.example`을 `.env.local`로 복사한 뒤 설정한다.

| 이름                                   | 공개 범위          | 용도                                                                          |
| -------------------------------------- | ------------------ | ----------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | 브라우저 공개 가능 | Supabase 프로젝트 URL                                                         |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 브라우저 공개 가능 | Supabase publishable key. RLS 적용 필수                                       |
| `SUPABASE_SECRET_KEY`                  | 서버 전용          | 검증된 메시지·AI 기록 저장. RLS 우회 키이므로 사용자 소유권을 서버에서 재검증 |
| `OPENAI_API_KEY`                       | 서버 전용          | OpenAI API 인증                                                               |
| `NOOK_JUDGE_MODEL`                     | 서버 전용          | Judge 허용 모델 3종 중 하나                                                   |
| `NOOK_JUDGE_REASONING_EFFORT`          | 서버 전용          | Judge 추론 강도 `low / medium / high`                                         |
| `NOOK_JUDGE_MAX_OUTPUT_TOKENS`         | 서버 전용          | Judge 출력 상한, 256~2048                                                     |

실제 키를 채팅, PR, 소스 코드에 넣지 않는다. Supabase secret key를 `NEXT_PUBLIC_` 변수에 넣지 않는다.
SDK 사용 시 설정이 없거나 유효하지 않으면 값 자체를 출력하지 않는 오류를 발생시킨다.
데이터 접근 전 RLS, 익명 인증, OAuth 연결·기존 계정 예외·세션 갱신을 구현해야 한다.
모델 호출 전 Safety Gate, 입력 제한, 요청량 제한, 비용 설정과 평가기를 준비해야 한다.

GitHub Actions의 저장소 secret 이름은 `AI_API_KEY`이며 평가 workflow 안에서만
`OPENAI_API_KEY`로 전달한다. 로컬·Vercel 런타임은 `OPENAI_API_KEY`를 별도로 설정해야 하며,
세 종류의 Judge 설정도 빈 값 없이 명시해야 한다.

로그인 사용자의 기록 보관·휴지통·복원 API 계약과 현재 검증 범위는 [구현 기록](docs/reviews/2026-09-13-retention-api.md)을 참고한다.

### 응답 지연 관찰

한 턴은 Safety Gate → Turn Judge → Reframe/Reflection을 순서대로 돈다. 각 단계가 얼마나 걸렸는지는 `ai_stage_timings`에 `LOAD / SAFETY / GENERATE / COMMIT` 네 줄로 남고, `GENERATE`에서 `judge_logs.latency_ms`를 빼면 생성 단계가 떨어진다. 모델 호출을 추가하지 않고 이미 일어나는 호출의 시간만 재며, 발화·사용자·세션은 담지 않는다. 같은 값이 표준 출력에도 `nook_stage`로 나간다. 측정값과 남은 관문은 [STATUS](docs/STATUS.md)를 따른다.

## 검증

```bash
npm run format:check
npm run validate
```

`validate`는 `typecheck` → `lint` → `build` 순서다.
`typecheck`는 깨끗한 체크아웃에서도 동작하도록 Next.js 라우트 타입 생성 후 TypeScript를 검사한다.

[`docs/EVALSET.md`](docs/EVALSET.md)는 평가 계약을 정의한다. 사용자 제공 JSONL은 `eval/`에 있으며 `npm run eval:validate`로 구조·참조·패치·현재 매핑 호환성을 검사한다. 확인된 계약 충돌이 남아 있으면 이 명령은 실패로 종료한다. `npm run eval`로 Judge 모델 평가를 실행할 수 있다. 운영 Judge는 `gpt-5.6-sol` / reasoning `low`이고, Reflect는 `gpt-5.6-terra` / `medium`이다. 2026-09-19에 fixture 39건을 세 조합으로 돌려 정했다 — sol/low 36/39, sol/medium 35/39, terra/medium 34/39이며 terra만 중심 질문의 이동을 세 건 놓쳤다. 단일 표본이므로 "내려도 나빠지지 않는다"까지가 이 숫자가 말해 주는 전부다. 이 결과는 Start·Safety나 실사용 정확도까지 보장하지 않는다. 근거와 남은 관문은 [STATUS](docs/STATUS.md)를 따른다.

## Vercel 배포

1. Vercel에서 공개 GitHub 저장소 `rudin0806/Nook`를 연결한다(연결 완료).
2. Framework Preset은 Next.js, Root Directory는 저장소 루트, Node.js는 24.x를 사용한다.
3. Install Command: `npm ci`, Build Command: `npm run build`. Output Directory는 Next.js 기본값을 유지한다.
4. 실제 연결 단계에서 필요한 환경변수를 해당 배포 환경에 등록한다.
5. 배포 완료 후 `/`의 한국어 첫 화면과 `/api/health`의 HTTP 200을 확인한다.

검색 제외 메타데이터는 접근 통제가 아닙니다. 개인정보를 다루는 실제 기능 공개 전 인증·RLS를 검증합니다.

## 문서 구조

루트에는 **진입점 문서만** 둔다.

- `README.md` — 사람이 처음 보는 프로젝트 안내, 실행법, 문서 지도
- [`AGENTS.md`](AGENTS.md) — Codex/AI 개발 도구가 지켜야 할 구현 규칙

제품 문서는 `docs/`에 모은다.

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

**같은 규칙을 README·AGENTS·PRD·RULES에 중복해서 유지하지 않는다.** 한 규칙이 바뀌면 그 규칙의 기준 문서 한 곳을 수정하고, 다른 문서에는 링크나 짧은 요약만 둔다.

빈 문서나 미래 계획용 파일은 미리 만들지 않는다.

### Judge 모델 평가

`npm run eval -- --dry`로 기본 경계쌍을 검사한다. 실제 호출 설정·비용 제한·보고서 범위는 [평가기 실행 안내](docs/reviews/2026-09-13-judge-model-runner.md)를 따른다.

실서비스용 Judge 호출 경계는 [런타임 어댑터 기록](docs/reviews/2026-09-14-judge-runtime-adapter.md)을 따른다. 공개 대화 API에 연결돼 있다. Safety·사용자 종료 의사·구조 상한을 먼저 통과하는 서버 흐름을 유지하며 현재 배포·검증 범위는 [STATUS](docs/STATUS.md)를 따른다.

### 소셜 로그인 연결

`/login`에는 Google 연결 버튼이 공개돼 있다. Kakao는 내부 어댑터만 있으며 버튼 공개·공급자 검증은 후속다. 배포별 `NOOK_SITE_URL`, Supabase 공급자·Manual Linking·redirect 설정과 실제 검증 순서는 [인증 연결 안내](docs/reviews/2026-09-14-auth-flow.md)를 참고한다. 익명 사용자 생성·CAPTCHA 검증 요구·identity linking 기반 코드는 있다. 닉네임 편집과 로그인 후 원래 보관 선택 복귀·선택 유지가 구현됐다. 실제 익명 시작 전체 왕복과 공급자 검증 범위는 STATUS를 확인한다. Turnstile UI에는 `NEXT_PUBLIC_TURNSTILE_SITE_KEY`와 Supabase Auth의 대응 CAPTCHA 설정이 필요하다.

### 첫 입력과 질문 승인 API

`/api/start`, `/api/start/focus`, `/api/start/approve`의 계약과 필요한 환경변수·공개 전 검증은 [구현 기록](docs/reviews/2026-09-14-start-api.md)을 따른다. 첫 입력과 승인을 내부 모듈·DB RPC까지 연결했으며 운영 공개는 별도 enable 설정으로 제어한다. 후보 서명은 응답/요청 본문에서만 전달하고 URL·로그·브라우저 영구 저장소에 보관하지 않는다.

### AI 실행 설정 사전 점검

`npm run release:env`는 현재 프로세스 환경과 존재하는 `.env.local`의 설정 형식만 검사한다. 값은 출력하지 않고 항목별 통과 여부를 표시한다. 모델별 허용 범위는 런타임과 공유하는 스키마를 사용한다. `npm run release:env -- --require-enabled`는 시작/대화 활성화 플래그까지 요구한다. 어느 명령도 모델 호출·DB 쓰기·기능 활성화를 수행하지 않는다. 키의 유효성·사용 가능 모델·DB 연결 및 실제 OAuth는 별도 검증이 필요하다. 로컬 결과를 Vercel 배포 설정 검사로 해석하지 않는다.
