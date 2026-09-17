# Nook 병행 작업 안내

제품 기준은 PRD/RULES, 개발 진행 상태는 STATUS다. **2026-09-16부터 main이 운영 코드와 일치한다.** 다만 과거에 갈라진 브랜치들이 서로를 포함하지 않으므로, 어떤 기능이 없어 보이면 다른 브랜치와 과거 커밋을 먼저 확인한다. 이 문서는 역할과 전달 형식만 정하며 제품 규칙을 새로 만들지 않는다.

## 역할 분담

| 담당 | 맡을 일 | 수정 범위 |
|---|---|---|
| Codex | 스키마·API·인증·RLS·화면 구현, 평가기 실행, 통합·회귀검사·병합 | 코드, migration, 승인된 기준 문서 |
| Claude | 프롬프트 초안과 개선안, 오답 원인 분석, 경계 사례 제안, UX 문구·사용성 테스트·발표 논리 | 작업별 제안서 `docs/proposals/<task-id>.md` |
| 수연 | 제품 의미가 달라지는 선택 확정 | 충돌 항목에 대한 결정 |

프롬프트도 서비스 동작의 일부다. Claude가 문안을 제안하면 Codex가 입출력 스키마와 테스트를 확인해 `src/prompts/`에 반영한다. 두 도구가 동일한 기준 파일을 동시에 수정하지 않는다.

## 현재 기준 — 2026-09-16 후속 구현

- main만 작업·push한다. 운영과 코드 매핑 및 실제 검증 범위는 [STATUS](STATUS.md)가 단일 기준이다.
- 5번 책 상세 목차·카드 이동, 6번 닉네임·로그인 후 보관 복귀가 구현됐다. 같은 기능을 다시 만들지 말고 STATUS의 운영 관문을 확인한다.
- 익명 ID 유지, 이메일 문자열 병합 금지. 복원한 선택은 사용자가 보관 여부를 다시 확인한다.
- 옛 vivid 스타일은 의도적으로 제외했다. 팔레트·상단탭·벤또·책등은 [디자인 문서](design/README.md)를 따른다.
- 예시 칩 PRD 정정은 사용자 결정 대기. 유료 모델 평가는 승인된 기존 결과를 유지하며 반복하지 않는다.
- 어떤 기능이 없어 보이면 과거 커밋을 확인한다. 브랜치 끝점만 보고 미구현으로 단정하지 않는다.
- 외부 인증/CAPTCHA 설정과 실제 로그인 왕복은 코드 구현과 별도 상태다. 로컬·fixture 검증을 운영 완료로 확대하지 않는다.

## 과거 작업 이력 — 당시 상태, 현재 체크리스트 아님

### C-01 — Safety 명칭 정합 수정 완료, 경계 평가 남음

2026-09-14 사용자 요청으로 기존 RULES §9와 EVALSET §6의 명시된 계약을 적용했다.
S-01~S-06은 category NONE, S-14는 NONE/SUICIDE_SELF_HARM, S-15는 NONE/GENERAL_MENTAL_HEALTH다.
S-14의 전달 책임 문구를 제거하고 기존 매핑의 기본/긴급 번호에 맞췄다.
입력·위험 label·behavior는 변경하지 않았다. 상세 변경과 검증 한계는 [EVALSET](EVALSET.md)의 Safety fixture 정합 수정 절에 있다.

Claude의 다음 범위는 제3자 즉시 위험·표현 변형 등 별도 경계 사례와 도움 안내 문구 검토다.
기존 정답 JSONL을 다시 바꾸기보다 사례 제안과 근거를 별도 문서로 전달한다.
현재 파일의 npm 전체 검증과 실제 Safety 모델 회귀는 아직 완료하지 않았다.

### C-02 — Prompt D 초안과 말투 검토 (완료)

Claude 산출물을 Codex가 스키마·근거 전달·PAST 제한과 함께 통합했다. 현재 기준은
[`src/prompts/prompt-reflect.ts`](../src/prompts/prompt-reflect.ts)와
[`통합 기록`](reviews/2026-09-13-C-02-integration.md)이다.

### C-03 — Judge 프롬프트와 오답 분석 (완료)

Prompt B 최소 수정과 실패 subset 재검증을 거쳐 Sol high strict 31/31을 기록했다. 현재 기준은
[`src/prompts/prompt-judge.ts`](../src/prompts/prompt-judge.ts)와
[`조정 기록`](reviews/2026-09-14-judge-sol-tuning.md)이다.

### Prompt C v2 — 내부 서버 통합 완료, 생성 품질 평가 전

v2는 `src/prompts/prompt-reframe.ts`와 `src/engine/reframe.ts`에 통합했다. [통합 기록](reviews/2026-09-14-prompt-c-integration.md)을 따른다. 이후 Claude 작업은 기존 프롬프트 예시와 겹치지 않는 C 평가 사례 및 문장 검토다.

Judge가 `SHIFT/HIGH`를 반환한 뒤 사용자 확인 전 보여줄 **새 중심 질문과 근거 한 줄**을 만든다.
RULES의 Reframe 경계, PRD의 Shift Proposal·User Confirm, Judge 출력 스키마만 읽는다. Judge 판정을
다시 판단하거나 Node를 확정 저장하지 않는다.

산출물은 프롬프트 초안, 입력·출력 필드 제안, 일반/경계 사례 8개, 과잉해석 금지 점검표다.
Codex가 최종 Zod 스키마·호출 형식·사용자 확인·DB 저장을 구현하므로 코드나 기준 문서를 직접
수정하지 않는다.

### 이후 적합한 업무

- AI가 먼저 대조를 제시한 음성 사례, 짧지만 새 정보가 있는 대화 등 추가 평가 사례 제안. 기존 정답셋과 분리해 검토한다.
- 저장·나가기·휴지통·질문 재시작 안내의 용어와 이해도 점검.
- 첫 사용자 테스트 질문지와 관찰 항목 작성.
- 발표의 문제·핵심 가설·데모·검증 결과 연결 점검. 측정하지 않은 성과를 만들지 않는다.

## 작업 전달 형식

한 작업에는 아래 정보만 전달한다.

```text
작업 ID:
기준: 저장소 / 브랜치 / 실제 확인한 commit SHA
목표: 이번에 해결할 한 가지
읽을 자료: 관련 절과 필요한 사례 ID만
변경 가능 범위:
고정할 규칙과 미결:
결과: 수정안 + 이유 + 영향 받는 사례 + 남은 질문
실행 여부: 실제 실행 / 문서 검토를 구분
```

반환할 때 문서 전체를 다시 붙이지 말고 변경 부분과 근거를 보낸다. 새 대화에서는 이 작업 묶음과 직전 결과만 전달한다. 같은 파일의 기준 SHA가 달라지면 먼저 차이를 확인한다.

## 토큰과 재작업을 줄이는 순서

1. 관련 문서 절과 사례만 한 번 읽고 기준 SHA를 기록한다.
2. 후보는 우선 하나만 만든다. 여러 버전을 동시에 전면 평가하지 않는다.
3. Codex가 실패 사례·위반 규칙·실제 출력을 짧게 전달한다. 개발용 fixture를 쓰고 실제 사용자 고민 원문은 포함하지 않는다.
4. Claude는 실패 원인과 최소 문구 변경만 반환한다.
5. Codex는 관련 사례부터 재검증하고, 반영 전 전체 회귀 검증을 실행한다.
6. 최종 결과는 STATUS와 해당 제안서에 남긴다. 긴 대화 기록을 매번 전달하지 않는다.

Core와 Safety 결과는 분리한다. 프롬프트 문안을 줄였다는 이유만으로 정확도나 안전 규칙이 좋아졌다고 판단하지 않는다.

## 인증 구현 체크포인트 — 현재 정정

Google OAuth·익명 identity linking·callback·로그아웃·익명 생성 기반은 구현됐다. Google 로그인 해결 및 운영의 인증된 목록 조회 기록이 있다. 닉네임 편집과 원래 보관 선택 복귀는 구현됐다. Kakao UI 공개와 익명 전체 왕복 검증은 남았다. 설정·검증 범위는 [인증 기록](reviews/2026-09-14-auth-flow.md)을 참고한다. Claude가 프롬프트/제품 규칙을 이 인증 구현에 맞춰 바꿀 필요는 없다.


## 현재 인수인계 — 2026-09-17

### 운영 기준

- 기준 브랜치: `main`만 사용한다.
- 기능 기준 커밋: `0da1941`.
- 최신 책장 UI 커밋: `bdd98745` (`feat(ui): restore bookshelf view for saved stories`).
- 문서·정리 migration 기준 커밋: `a154ce1`.
- 운영 배포: `dpl_Gbc4DFDuVTjXtUbRFyXu2ai4M1o2` READY (source git, `a7aa260`).
- 책장 미리보기 가장자리 보정 커밋: `a7aa260` (`fix(ui): keep shelf previews inside the viewport on mobile`).
- 운영 주소: https://nook-nine-eta.vercel.app/
- 5번 상세 탐색·카드 이동, 6번 닉네임·로그인 후 보관 복귀, 책장 정렬 충돌 검사는 코드와 운영에 반영됐다.
- 보관한 이야기 `/drawer`는 책장형 책등 그리드다. 데스크톱 10권×2줄, 모바일 5권×4줄(페이지 크기 20)이며 hover/focus 때 단일 권 미리보기, 클릭/Enter 때 `/drawer/:sessionId` 상세 이동을 제공한다. 순서 편집 모드와 질문·휴지통 컬렉션은 기존 UI를 유지한다.
- 기능 코드를 다시 구현하거나 vivid UI를 되살리지 않는다. 현재 기준은 `docs/STATUS.md`, `docs/ERD.md`, `docs/design/README.md`다.

### 최신 책장 UI 검증

- `npm run validate` 통과.
- 단위 테스트 157/157 재실행 통과.
- Vercel `dpl_Gbc4DFDuVTjXtUbRFyXu2ai4M1o2` READY, main의 `a7aa260` source git 확인.
- 브라우저 검증은 같은 커밋의 로컬 프로덕션 빌드(`next start`)에서 수행했다. 이 작업 환경은 프록시가 `vercel.app`을 막아 운영 주소로 브라우저를 직접 띄우지 못한다. 운영 주소 확인이 필요하면 로컬 개발 환경에서 한다.
- 최근 1시간 Vercel runtime error 0건.
- 브라우저 검증 완료(2026-09-17, Claude, Chromium): 데스크톱 10×2, 모바일 5×4, hover/focus 미리보기, 키보드 Enter로 `/drawer/:sessionId` 이동, reduced-motion, 편집 모드의 drag/arrow 목록, 질문·휴지통 카드 UI를 모두 측정으로 확인했다. 방법은 로컬 프로덕션 빌드에서 `/api/sessions` 응답만 20권으로 대체한 것이다.
- 이때 모바일 책장 화면에만 가로 스크롤이 생기는 결함을 찾아 CSS만 수정했다(양끝 열 미리보기 안쪽 정렬). 마크업·동작·백엔드는 건드리지 않았고 vivid UI도 되살리지 않았다.
- 남은 것은 실제 계정 로그인 상태의 운영 왕복과 실기기 터치다.

### Supabase에서 마지막으로 할 일

새 앱은 옛 `reorder_saved_sessions(uuid[])` RPC를 호출하지 않는다. 삭제용 migration은 저장소에 이미 있다.

- 파일: `supabase/migrations/20260916141829_drop_legacy_reorder_saved_sessions.sql`
- 프로젝트 ref: `aybyxovmabsfvcugvnst`
- 실행 SQL:

```sql
drop function if exists public.reorder_saved_sessions(uuid[]);
```

적용 뒤 아래 조회 결과가 0행인지 확인한다.

```sql
select n.nspname as schema_name,
       p.proname,
       pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'reorder_saved_sessions';
```

**2026-09-17 적용 완료.** 적용 전에 이 함수를 참조하는 다른 DB 함수가 없음을 확인했고, 적용 후 위 조회가 0행이며 `move_saved_session`·`move_saved_session_checked`·`normalize_shelf_positions`·보관/복원/휴지통 함수가 그대로 남아 있음을 확인했다. Supabase에 남은 정리 작업은 없다.

### 탈퇴·정책 — 2026-09-17

- `delete_own_account()` migration `20260917051500` 운영 적용 완료. 인자가 없어 호출자 본인만 삭제되고, `authenticated`만 실행할 수 있다.
- 삭제 연쇄는 운영에서 합성 사용자로 측정했다(9개 테이블 0행, 전부 rollback). `auth.identities`까지 CASCADE다. SQL 회귀는 `supabase/tests/account_deletion.sql`.
- 유예 기간 없음. 개인정보보호법 제21조 지체 없는 파기를 따르며 Nook에는 보존 의무 기록이 없다. 이 결정을 바꾸려면 보존 근거부터 정해야 한다.
- `/privacy`, `/terms` 추가. 수집 항목·보유 기간·수탁자는 스키마와 리전에서 확인한 값만 적었다.
- **사용자가 채워야 하는 자리 7곳**이 `.legal-pending`으로 표시돼 있다: 운영 주체명(2), 보호책임자 성명(1), 연락 이메일(2), 시행일(2). 지어내지 말 것.
- 아직 없는 것: 회원가입 동의 분리(필수/선택)와 동의 기록 테이블. 현재는 로그인 화면 링크 고지만 있다.

### 로고 — 확정 (2026-09-17)

- **`components/nook/wordmark.tsx` 한 곳에서만 만든다. 인라인으로 다시 쓰지 말 것.** 이전에 6곳에 흩어져 있었고 그 중 3곳이 소문자 `nook` + 색 온점이라 온점이 반복해서 되살아났다.
- 규격: **Nook 표기, SUIT 800, 잉크 단색, 온점 없음, 꾸밈 요소 없음.** 넓은 `ook`은 SUIT에 폭 축이 없어 `scaleX(1.22)`로 만든다.
- 마크의 일부에 색을 주는 CSS 규칙을 추가하지 말 것(`--nook-gold` 온점 규칙은 삭제됐다).
- 이건 사용자가 여러 번 요청한 사항이다. 바꾸기 전에 반드시 확인받을 것.

### 비로그인 노드 1 제한 — 적용됨 (2026-09-17)

- 방문자는 첫 질문까지 도달하고 그 안에서 대화한다. 두 번째 질문 승인에서 `IDENTITY_LINK_REQUIRED`로 막힌다. 가드는 `commit_conversation_step`의 `approve` 단계.
- 제안된 질문은 거절 뒤에도 `pending`에 남는다. 이걸 지우면 "무엇을 위해 로그인하는지"가 사라진다.
- 오류 코드가 화면까지 가려면 RPC → `src/lib/api/conversation.ts` → `ai-http.ts`(401+코드) → `src/lib/conversation/client.ts`(본문 코드 읽기) → 패널 4단이 모두 필요하다. 한 곳만 끊어도 일반 실패 문구로 되돌아간다.

### 재동의 — 적용됨 (2026-09-17)

- 중대 변경은 차단, 경미 변경은 배너. 기준은 `src/lib/legal/versions.ts`의 `RECONSENT_REQUIRED_FROM`.
- 문구만 고쳤으면 `TERMS_VERSION`/`PRIVACY_VERSION`만 올린다. 수집 항목·목적·수탁자가 바뀌었으면 `RECONSENT_REQUIRED_FROM`도 같이 올려야 차단이 걸린다.
- 게이트는 `/`, `/drawer`, `/talk/:nodeId`에만 있다. `/login`·`/privacy`·`/terms`·`/consent`를 막으면 동의 자체가 불가능해진다.

### 책등·톤·워드마크 — 2026-09-17 2차

- 책등은 `text-orientation: upright` + 숫자 묶음 `text-combine-upright: all`. `mixed`로 두면 한글은 세워지고 숫자만 누워 깨져 보인다. 되돌리지 말 것.
- 책등 라벨은 두 자리 연도(`26.10.10`)로 8글자를 넘지 않게 고정했고, 넘칠 때는 `clampSpineLabel`이 `…`를 붙인다. 세로쓰기에는 브라우저 말줄임이 없다.
- 세로쓰기에서 `flex-direction: column`은 가로 방향이다. 책등 안에서 위→아래로 쌓으려면 `row`다.
- 책장은 10열 고정 그리드가 아니라 줄 단위 flex다. 책이 흐름 안에 있어야 정면으로 커질 때 이웃을 밀어낸다. 절대배치로 되돌리면 밀어내기가 사라진다.
- 책 폭·높이·여백은 `data-shape` 10종이며 위치에서 계산한다. 균일하게 만들지 말 것.
- 책장 색은 `--tone-1..8-bg/fg` 전용 토큰이다. 의미 팔레트(`--nook-primary` 등)를 여기에 쓰지 말고, 바꿀 때는 라이트·다크 16조합 대비를 다시 재라(기준 4.5:1).
- 워드마크는 SUIT, 본문은 Pretendard. **이건 사용자 요청이었고 이전 핸드오프에서 누락됐다.** 지우지 말 것.

### 탈퇴 — 즉시 삭제 + 재가입 30일 제한 (2026-09-17 확정)

- 중간에 30일 유예로 만들었다가 되돌렸다. 사용자의 "1달"은 유예가 아니라 보유기간 얘기였다. **유예 구조로 다시 되돌리지 말 것.**
- `delete_own_account(p_identity_hash text)`가 해시를 먼저 기록하고 `auth.users`를 지운다. 되돌릴 수 없다.
- 재가입 제한은 `withdrawn_identities`의 HMAC 한 줄로만 이뤄진다. 키는 `NOOK_REQUEST_HMAC_SECRET`, 입력은 provider subject(이메일 아님), 용도 라벨 `nook:rejoin-block:v1`. **이메일이나 subject를 평문으로 저장하지 말 것.**
- 이 테이블은 정책도 GRANT도 없다. 늘리지 말 것. 컬럼 3개 제약을 SQL 테스트가 단언한다.
- 차단 판정은 `/api/auth/callback`에서 한다. Supabase가 계정을 먼저 만들므로 차단 시 그 계정을 삭제하고 내보낸다.
- 시간당 cron이 만료 해시를 지운다(`purge_expired_rejoin_blocks`).
- 정책 문서에 즉시 파기 + 해시 30일 보관이 명시돼 있다. 로직을 바꾸면 문서를 같이 고쳐야 한다.

### 비로그인 플로우 — 확인된 사실

- 익명 사용자는 세션 시작과 노드 도달이 가능하도록 이미 구현돼 있다. DB가 막는 지점은 `keep_session or cardinality(kept_branch_ids) > 0`, 즉 보관뿐이다.
- 운영은 `anonymousEnabled: false`라서 익명 세션 자체가 생성되지 않고 `/api/start`가 401을 반환한다. 첫 발송에서 로그인 안내가 뜨는 원인이 이것이다.
- **노드 수 제한은 없다.** 익명은 세션을 끝까지 돌릴 수 있고, 막히는 지점은 보관뿐이다. "노드 1회까지만"은 사용자가 제시한 두 안 중 하나였고 채택되지 않았다. 제한을 넣으려면 새 결정이 필요하다.
- **익명에게는 이미 즉시 완전 삭제 경로가 있다.** `finalize_session_retention`에서 익명이 `keep_session=false`를 고르면 휴지통이 아니라 하드 삭제다(로그인 사용자는 휴지통 7일). 계정 자체가 없으므로 익명용 탈퇴 UI는 중복이며 붙이지 않는다. 이전 핸드오프의 "권리 관점 구멍" 서술은 화면을 확인하지 않은 오판이었다.
- 켜려면 Supabase Auth 익명 로그인 활성화 + hCaptcha secret 등록·CAPTCHA 강제 + **Vercel 환경변수** `NOOK_ANONYMOUS_SIGN_IN_ENABLED=true`, `NEXT_PUBLIC_HCAPTCHA_SITE_KEY`. 이 플래그는 Supabase가 아니라 Vercel 환경변수를 읽으므로 콘솔 설정만으로는 켜지지 않는다. CAPTCHA 없이 열면 안 된다.

### 폰트

- 본문은 Pretendard v1.3.9(400/500/600), 워드마크는 SUIT Variable. 워드마크의 넓은 `ook`은 SUIT에 폭 축이 없어 `scaleX(1.22)`로 만든다.

### 남은 운영 검증

- Turnstile 사이트 키·서버 secret·익명 인증 강제 설정을 확인하고 익명 시작→종료→보관 왕복을 실제로 확인한다.
- Google OAuth 성공·취소·만료와 identity linking 왕복을 확인한다. 이메일 문자열로 계정을 병합하지 않는다.
- 실제 계정으로 로그인한 운영에서 여러 권 이동·재접속과 실기기 터치를 확인한다. 책장 배치·hover/focus/Enter·reduced-motion은 로컬 프로덕션 빌드 측정으로 확인됐다.
- 만료 데이터가 생긴 뒤 pg_cron 정리 실행 이력을 관찰한다. 예약 job 자체는 활성·성공 이력이 있다.
- 위 검증은 이미 배포된 기능의 운영 확인이며, 기능 재구현이나 유료 모델 재평가가 아니다.

### 확인된 검증

- 단위 테스트 157/157.
- `npm run validate` 통과.
- PGlite migration 14개·SQL suite 10개·release readiness 11 checks 통과.
- 공개 운영 홈 로드 및 최신 책장 배포 후 runtime error 0건 확인.
