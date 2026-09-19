# Nook 현재 상태 — 2026-09-16 실사 기준

이 문서가 현재 진척도의 기준이다. 과거의 미구현·미배포 문구를 현재 상태로 재사용하지 않는다. [이전 STATUS 원문](reviews/2026-09-16-status-history.md)은 이력으로 보존했다.

## 기준 버전과 운영 배포

- 운영: https://nook-nine-eta.vercel.app/
- 현재 배포: `dpl_387H51i2jBD3BP3iAQGMbp7j4bA3`, **READY / production**. 이번 Vercel 조회로 두 운영 별칭 연결을 확인했다.
- 코드 보존 브랜치: `codex/restore-node-navigation-and-shelf-order-20260916`.
- 실사 기준 커밋: `56f09e46ee671fa1a16d924fb8bf22348865f5ea`. 뒤따르는 이번 커밋들은 문서 정리다.
- **`main` = `b6fcc95`가 기준이다. main이 운영 코드와 일치한다.** 이전까지 main은 09-13(`65f9e63`)에 멈춰 있었다. 아래 커밋들이 보존 브랜치 `e1bf2e1` 위에 얹혀 main으로 올라갔다.
  - `81ab2c8` 저장된 이야기 상세 조회 `shelf_position` 결함 수정 (아래 결함 1)
  - `ab33c37` conversation·hedge 테스트 fixture 스키마 정합
  - `72a8f54` 홈 벤또 복원 + 라이트/다크 조명
  - `80a2a90` 책장 50권 초과 정렬 (아래 결함 2)
  - `8532916` 문서 갱신
  - `f7d24c0` 입력 필드 확대, 예시 칩 제거
  - `471f2a7` 팔레트 개정, 상단탭, 라이트 모드 결함 수정
  - `b6fcc95` 로그인 단일 카드 재구성, 워드마크
- **Vercel ↔ GitHub 연결 완료. main에 push하면 자동 배포되고 배포마다 `githubCommitSha`가 남는다.** 이전에는 프로젝트가 저장소에 링크되지 않아 push로 배포가 되지 않았고, 배포는 파일 업로드 방식이어서 어느 커밋이 올라갔는지 기록이 없었다. 원인은 무료 플랜 제한이 아니라 Vercel GitHub 앱이 "Never used" 상태였던 것이다.
  - **배포는 main에만 push한다.** 다른 브랜치에 같이 push하면 preview 배포가 추가로 생겨 일 100회 한도를 쓴다.
  - 파일 업로드 방식이던 과거 배포에 Git SHA가 없다는 기록은 이제 해당하지 않는다.
- 배포 후이므로 옛 `reorder_saved_sessions` RPC와 `/api/sessions/order` 라우트를 **이제 제거할 수 있다.** 배포 전에 지우면 운영이 깨져서 남겨둔 것이다.
- 선행 프롬프트 브랜치: `codex/claim-fidelity-five-20260916` / `f5aefa929194e4c0f9731fd2e6778314c85ca017`.
- vivid 디자인 보존 브랜치: `codex/recover-vivid-nook-ui-v2-20260916` / `8c199e1a6b18c0674028c626652d7bd4b2d64122`. 현재 운영 디자인 기준으로 사용하지 않는다.
- 운영 배포는 파일 업로드 방식이다. Vercel metadata에 Git SHA가 없어 **특정 커밋과 전체 배포 파일의 byte 단위 일치가 증명된 것은 아니다**. 이전 실행의 업로드·커밋 기록으로 연결한 기준이며 향후 재현 가능한 Git 기반 릴리스가 필요하다.

## 6개 작업의 실제 상태

| 항목                                   | GitHub 구현                                                    | 운영 반영                             | 검증 근거 / 남은 범위                                                                                                                                                  |
| -------------------------------------- | -------------------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. 프롬프트 실제 응답 최소 확인 → 배포 | claim-fidelity 프롬프트·평가기·테스트 있음                     | 이전 작업의 운영 배포 완료 기록 있음  | 사용자가 전달한 5개 실제 응답 검토 완료 기록 유지. 이번 실사에서 모델 재호출하지 않음. 같은 평가를 다시 미구현으로 분류하지 않음                                       |
| 2. 대화 시작 → 종료 → 저장             | UI·시작/승인/대화/보관 API·DB RPC 구현됨                       | 해당 코드가 운영 배포 묶음에 포함됨   | 이전 실제 대화 실행·보관 데이터·로그인된 목록 조회 증거 있음. 이것을 모든 실패/익명/OAuth/복원 경로 통과로 확대하지 않음. 미구현 아님                                  |
| 3. 노드 클릭 → 과거 대화 → 현재 복귀   | 구현·GitHub 보존 완료                                          | 복구 후 운영 재배포 완료              | 이전 작업 보고에 12/12 회귀, 운영 이동/복귀·모바일 2열·키보드·모션 감소·Anchor 지원 확인. 이번에 재실행하지 않았다는 이유로 완료 이력을 취소하지 않음                  |
| 4. 책장 드래그·순서 편집·저장          | 한 권 이동 방식으로 재구현. 50권 상한 제거, 페이징 노출        | **DB는 적용 완료, 앱은 재배포 안 됨** | 독립 Postgres에서 60권 이동 회귀 통과(`shelf_order.sql`). 실제 브라우저 다중 이동·재접속 정렬 미검증. 결함 3의 revision 비교는 여전히 없음                             |
| 5. 책 상세 탐색·카드 넘김 고도화       | 기본 상세 조회·구간 페이지 이동·질문 재시작 있음               | 기본 구현 배포됨                      | **선행 결함(상세 조회 schema)은 `81ab2c8`에서 해결됐다.** 내부 질문/구간 탐색·카드 전환 모션·모바일/키보드·reduced-motion은 아직 구현 안 됨. 여기가 다음 착수 지점이다 |
| 6. 닉네임·익명→로그인 후 저장 복귀     | Google OAuth/linkIdentity·동일 사용자 검사·익명 생성 기반 있음 | 인증 기반 코드 배포됨                 | 닉네임 편집은 없음. 로그인 성공은 /drawer 고정 이동, 보관 UI는 새 창 로그인 링크만 제공. 원래 보관 화면 자동 복귀·선택 유지 미구현                                     |

완료율 %를 제시하지 않는다. 기능 수와 통합 검증 수준이 다르며, “코드 있음 / 운영 배포됨 / 사용자 흐름 검증됨”은 서로 다른 상태다.

## GitHub에 이미 기록된 기능 지도

| 영역           | 구현 내용                                                              | 대표 코드                                                                                                    |
| -------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 시작           | 입력·초점 선택·시작 질문 생성·수정/승인                                | src/components/nook/thought-input.tsx, src/app/api/start/, src/engine/start-flow.ts                          |
| 대화           | Safety→Judge→C/D, SHIFT 승인/거절, 종료/구간 전환                      | src/app/api/conversation/route.ts, src/lib/api/conversation.ts, src/engine/conversation.ts                   |
| 노드 이동      | 메시지 연결, 선택 노드 재클릭 복귀, Anchor                             | src/components/nook/conversation-panel.tsx, src/lib/api/conversation-context.ts, src/schemas/conversation.ts |
| 보관           | 남기기/버리기, Branch 별도 선택, 휴지통·복원·질문 삭제                 | src/components/nook/conversation-retention.tsx, src/lib/supabase/retention.ts, src/app/api/sessions/         |
| 복귀           | 임시 대화 목록·승인 전 제안 복구·세션 복귀                             | src/components/nook/recovery-list.tsx, src/components/nook/resume-panel.tsx, src/app/api/recovery/           |
| 연결 재시작    | 승인 질문·남긴 질문·초기 입력에서 새 세션, 출처 링크                   | src/app/restart/, src/components/nook/restart-panel.tsx, src/components/nook/session-origin.tsx              |
| 책장 정렬      | drag/drop, 위/아래 버튼, 취소/저장                                     | src/components/nook/drawer-contents.tsx, src/app/api/sessions/order/route.ts                                 |
| 상세           | 승인 노드·유효 clarification·10구간씩 조회                             | src/components/nook/saved-story-contents.tsx, src/lib/retention/story-query.ts                               |
| 인증           | Google UI, Kakao 내부 어댑터, PKCE·identity linking·로그아웃·오류 구분 | src/lib/auth/, src/app/api/auth/, src/components/nook/account-panel.tsx                                      |
| 익명 기반      | CAPTCHA 토큰 요구·서버 생성·동일 사용자 검증                           | src/lib/auth/anonymous.ts, src/lib/supabase/anonymous.ts                                                     |
| 자동 정리 기반 | secret·환경·활성화 조건을 확인하는 실행 API                            | src/app/api/cron/retention/route.ts, src/lib/retention/maintenance.ts                                        |
| 평가·가드      | 모델 allowlist·출력 검증·요청 제한·환경 점검                           | src/engine/, src/prompts/, scripts/, tests/, supabase/tests/                                                 |

익명 생성 모듈의 존재가 실제 CAPTCHA UI 연결·공급자 설정·익명 공개 운영 검증 완료를 의미하지 않는다. Cron API 존재도 예약 등록·정상 실행을 의미하지 않는다.

## 확인된 결함과 다음 작업

### 우선 수정할 회귀

1. **책 상세 조회 schema 불일치 — 해결 (`81ab2c8`)**: `savedSessionListItemSchema`가 `shelf_position`을 필수 nullable로 받는데 `story-query.ts`의 SELECT가 빠뜨려 상세 조회가 항상 Zod `invalid_type`으로 실패했다. 같은 테이블을 읽는 목록 쿼리(`retention.ts`의 `sessionCollections.saved.columns`)가 이미 그 컬럼을 선택하고 있어 의도된 컬럼 집합을 대조로 확정했다. 같은 스키마를 parse하는 fixture 2곳(`tests/saved-story.test.mts`, `tests/retention-api.test.mts`)도 컬럼 도입 때 갱신되지 않아 이 결함을 기존 테스트 실패로 위장하고 있었다. 운영 HTTP 왕복으로 재확인한 것은 아니다.
2. **책장 50개 초과 처리 누락 — 해결 (`80a2a90`, 운영 DB 적용 완료)**: 정렬이 전체 SAVED id 배열을 요구하면서 배열 상한이 50이고 개수까지 일치해야 했다. 51권부터는 두 조건을 동시에 만족할 수 없어 정렬이 구조적으로 불가능했고, 목록도 50개 한 페이지만 읽고 페이지 버튼을 숨겨 뒤 기록에 닿을 수 없었다. `move_saved_session(세션, 목표위치)`로 바꿔 책 한 권과 목표 자리만 보내고, 책장은 다른 컬렉션과 같이 20개씩 페이징하며 페이지 버튼을 노출한다. 페이지는 페이지 밖 책을 대변할 수 없으므로 이동은 한 건씩 즉시 저장한다. 저장 개수 상한은 두지 않고 요청 크기만 제한한다.
3. **정렬 충돌 — 피해 범위 축소, 완전 해결 아님**: `move_saved_session`은 옛 자리와 새 자리 **사이 구간만** 이동하므로 전체 배열 쓰기가 남의 순서를 통째로 덮는 문제는 사라졌다. 다만 **순서 revision을 비교하지 않는다.** 두 탭이 같은 책을 동시에 옮기면 마지막 쓰기가 이긴다. `ai_request_limits` 행 잠금으로 직렬화는 되지만 경쟁 회귀검사는 아직 없다. "다른 탭 변경은 모두 409"라는 과거 설명은 여전히 부정확하다.
4. **정렬 중 상호작용·응답 확인 — 부분 해결**: 저장 중 `draggable`을 끄고 이동 함수에 잠금을 넣었다. 클라이언트는 배열 길이가 아니라 **서버가 반환한 자리 번호**를 검증하고, 실패하면 옮기기 전 순서로 되돌린다. 실제 브라우저에서 다중 이동·재접속 정렬은 아직 검증하지 않았다.

### 기능 고도화

- 5번: 위 상세 회귀를 먼저 해결하고 내부 질문/구간 탐색·카드 전환 모션·모바일/키보드·reduced-motion 검증.
- 6번: 닉네임 입력/검증/저장/재조회, OAuth 후 원래 보관 선택으로 복귀, 선택한 질문 유지, 취소·만료·다른 계정 충돌 처리.
- 인증에서는 익명 사용자 ID를 유지하는 identity linking 원칙을 지킨다. 이메일 문자열로 계정을 합치거나 기록 소유자를 임의 변경하지 않는다.

### 출시·운영 후속

- 다중 카드 정렬→저장→새로고침·재접속, 다른 계정 접근 거절, 동시 변경 회귀.
- 익명 시작→로그인→보관의 실제 왕복은 별도 인수 관문. 완료된 일반 대화/노드 기능을 다시 구현할 이유가 아니다.
- Cron 예약은 활성화했다(위 절). 남은 것은 실제 만료 데이터가 생긴 뒤의 실행 이력 관찰과 `cron.job_run_details` 확인이다.
- Kakao 공급자/버튼 공개·브랜딩은 기존 별도 후속 항목.
- 최신 브랜치 CI/전체 테스트·main 병합·배포와 Git 커밋 매핑 정리. 이번 조회에서 해당 브랜치 workflow run 목록은 비어 있었다. 과거 단위 테스트 수를 이번 HEAD의 전체 회귀 결과로 표시하지 않는다.

## 운영 DB 적용 이력

이번 원격 migration 조회에서 12건을 확인하고, `move_saved_session`을 적용해 **13건**이 됐다. 10건/12건/미적용이라는 과거 문구는 현재 상태가 아니다.

`move_saved_session` 적용 내용: 신규 함수 2개(`move_saved_session`, `normalize_shelf_positions`)와 기존 함수 3개 교체(`finalize_session_retention`, `restore_session_from_trash`, `move_session_to_trash`). **기존 데이터는 바꾸지 않았다** — 적용 후 세션 2건·보관 1건·메시지 4건 그대로이고 보관됐는데 자리 없는 행은 0건이다. `shelf_position`은 다음 보관·복원·이동 시점부터 채워진다. 권한은 `move_saved_session`만 `authenticated`이고 `normalize_shelf_positions`는 `service_role` 전용이다. 되돌리려면 `20260915011312_session_recovery_and_restart.sql`의 함수 정의를 다시 적용한다. 옛 `reorder_saved_sessions`는 배포된 앱이 아직 호출하므로 남겨뒀다.

## 자동 정리 예약 — 이번에 활성화

**pg_cron 1.6.4를 설치하고 예약을 등록했다. 이전 문서의 "미설치·미가동"은 현재 상태가 아니다.**

```
jobid 1 · nook-retention-cleanup-hourly · 17 * * * * · active=true
username=postgres · database=postgres
command: select public.purge_expired_sessions();
```

등록 직후 `purge_expired_sessions()`를 한 번 직접 실행해 오류 없이 0건 처리되는 것을 확인했고 데이터는 변하지 않았다. 활성화 시점에 만료 대상과 삭제 기한 초과가 모두 0건이었으므로 **켜는 것만으로 삭제된 기록은 없다.**

함수가 실제로 하는 일(`settle_retention_for_user`): 계정이 연결된 사용자의 만료된 임시 대화는 삭제가 아니라 `COMPLETED + TRASHED`로 옮기고 `purge_after = 만료시각 + 7일`을 준다. 익명 사용자의 만료 임시 대화, Safety로 멈춘 세션, 휴지통에서 기한이 지난 것은 hard delete한다. 아직 실제 만료 데이터가 발생한 뒤의 실행 이력은 관찰하지 않았다.

| 이름                             | 원격 버전          |
| -------------------------------- | ------------------ |
| nook_core_schema                 | 20260912000918     |
| nook_access_and_retention        | 20260912000940     |
| fix_temporary_expiry_nullable    | 20260912001339     |
| harden_retention_rls_and_indexes | 20260912011744     |
| validate_final_branch_sources    | 20260913003147     |
| ai_request_admission             | 20260914090858     |
| approve_start_question           | 20260914090912     |
| start_api_persistence            | 20260914093022     |
| conversation_runtime             | 20260915015038     |
| session_recovery_and_restart     | 20260915015057     |
| closure_choice                   | 20260915123746     |
| saved_session_shelf_order        | 20260916063642     |
| move_saved_session               | 이번 적용 (13번째) |

저장소 정렬 파일명은 20260916050000_saved_session_shelf_order.sql이다. 파일명과 원격 버전 차이를 알고 적용 이력을 대조해야 하며 중복 적용하지 않는다. 보안 advisor 경고는 이전 점검에 남아 있으며 “DB 적용 완료”가 “보안 경고 0”을 뜻하지 않는다.

## 홈 화면 — 벤또 복원과 라이트/다크 (`72a8f54`)

롤백 과정에서 홈이 입력 카드 + 정적 안내 패널(`desk-grid`)로 축소돼 조명·책장·이어갈 대화가 들어갈 자리가 없어졌고, `<html>`이 `data-seed-color-mode="dark-only"`로 고정돼 있었다. 벤또 구성과 테마 배선을 되살렸다.

- 구성: `home-desk.tsx`의 `.home-bento`에 입력(왼쪽 통째) + `ThemeControl`(조명) + `ShelfPreview`(책장) + `RecoveryList`(이어갈 대화)
- 테마: `layout.tsx`의 블로킹 스크립트가 `localStorage['nook-theme-v1']` → `prefers-color-scheme` 순으로 초기 테마를 정하고 `documentElement.dataset.theme`와 `dataset.seedColorMode`를 세팅한다. `ThemeControl`은 `useSyncExternalStore`로 구독한다. `<html>`은 `system`이다.
- 스타일: `src/app/redesign.css`를 새로 썼다. vivid 브랜치(`codex/recover-vivid-nook-ui-v2-20260916`)의 673줄 `redesign.css`는 **가져오지 않았다** — 사용자가 완성도와 맥락 없는 컬러감 때문에 되돌린 스타일이 거기 있다. 구성과 테마 동작만 가져오고 색은 승인된 시안 기준으로 다시 잡았다.
- 시안 반영 3건: 입력 열을 넓히고 입력 블록을 카드 아래로, 빈 책장은 선반 판과 책 자리를 남겨 책장으로 읽히게, 이어갈 대화의 빈 자리 점선을 또렷하게 하고 문구를 점선 안으로.

### 팔레트 개정과 UX 결함 수정 (`471f2a7`, `b6fcc95`)

팔레트를 페리윙클 주색으로 재정의하고 앰비언트 광원을 제거했다. 값과 사용 규칙은 [디자인 문서](design/README.md)가 기준이다. 조명을 켤 수 있게 되면서 드러난 다크 전용 하드코딩과 UX 결함을 함께 고쳤다.

| 고친 것            | 내용                                                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| 메뉴               | 좌측 사이드바 → **상단탭**(선택 탭 밑줄). 모바일은 하단바 유지                                                                  |
| h1 중복            | 한 페이지에 h1이 둘이었다. 카드 제목을 h2로 내렸다                                                                              |
| 비로그인 책장      | "로그인하면 볼 수 있어요"만 있고 갈 곳이 없었다. `계정 연결하기` 링크를 넣었다                                                  |
| 모바일 하단바      | `globals.css:818`이 `#202323` 하드코딩이라 라이트에서 검은 바였다. 토큰화하고 불투명하게                                        |
| 로그인 좌측 패널   | `.account-art`가 근검정 하드코딩이라 라이트에서 검은 슬래브였다. 분할 레이아웃 자체를 없애고 단일 중앙 카드로 재구성            |
| 로그인 브랜드 마크 | 헤더 워드마크·`n.`·`MY LITTLE NOOK` 셋이 경쟁했다. 하나만 남겼다                                                                |
| 레거시 토큰        | 새 팔레트가 `--nook-gold/mint/peach`를 정의에서 빼자 `/talk`·`/drawer`·`/login`이 옛 다크 값으로 떨어졌다. 새 팔레트에 매핑했다 |
| 예시 칩            | 사용자 요청으로 제거. **PRD §4·§19에는 아직 칩이 명세돼 있어 모순이 열려 있다**                                                 |

### 남은 UI 작업

**책등 표현과 책상 컨셉은 유지한다** — `docs/design/README.md`의 "세로 책등 표현을 제거한다"는 문구는 뒤집혔다.

- **이어갈 대화의 빈 자리는 겹쳐 기울어진 점선 카드 3장.** 현재 구현은 회전 폭이 작아 거의 한 장으로 읽힌다. vivid `redesign.css:646-649`가 참고다.
- **카드 스와이프.** `recovery-list.tsx`에 dialog·`.card-stack`·`.browse-card`·`.card-controls`(이전/다음·`n / total`) 마크업이 이미 있다. **레이아웃 CSS는 두 vivid 브랜치에도 색상 규칙만 있다.** 브랜치 끝점에는 없으니 `a410781 feat(ui): warm desk, question cards and bookshelf...` 등 과거 UI 커밋에서 찾아야 한다.
- **라이트 모드 부채.** `globals.css`에 다크 전용 하드코딩이 아직 **12곳** 남아 있다(`#251b0c`·`#172b20` 텍스트, `#71553e`·`#536c5d`·`#708476` 테두리, `#332920`·`#1b1e1d` 배경 등). 눈에 보이는 5곳(`.account-art`·`.clarity-panel`·`.closure-panel`·`.desk-guide`·`.account-error`)만 토큰화했다. **`/talk` 대화 화면을 라이트로 열면 나머지가 드러날 수 있다.**

## 증거와 검증 범위

- **이번 직접 확인**: GitHub 브랜치/HEAD/트리 및 관련 파일, Vercel 운영 READY·별칭, 원격 migration 12→13건, 상세 schema 최소 재현.
- **이번 직접 실행**: 오프라인 단위 테스트 **153/153** (작업 시작 시점 136/153), `npm run validate`(typecheck·lint `--max-warnings=0`·build) 종료코드 0, `npm run eval -- --dry`와 `npm run eval:judge:validate` 통과(judge fixture 39건 정합), 독립 Postgres 재현으로 migration 11개·SQL 테스트 9개 전부 PASS(신규 `supabase/tests/shelf_order.sql` 포함), 로컬 dev 서버에서 홈 라이트/다크/모바일 렌더 확인.
- **`shelf_order.sql`이 증명하는 것**: 60권 책장에서 앞·뒤·중간 이동과 위치 클램프, 이동 후 자리 연속성, 타 사용자 세션 거절, 익명 거절, 0 이하 위치 거절, 보관·복원 시 자리 배정과 휴지통 이동 시 자리 해제.
- **유료 모델 호출 0회.** 이번 작업에서 실제 모델 평가는 실행하지 않았다.
- **이전 직접 실행 기록**: 3·4 작업 시 타입·린트·빌드 통과, 운영 홈/로그인된 책장 조회, health 200, 해당 시점 오류 로그 0, 단일 카드 정렬 RPC rollback.
- **이전 대화에서 전달된 완료 보고**: 프롬프트 실제 5개 검토, 노드 이동 12/12·운영 왕복. 이전 완료 증거로 유지하되 이번 재실행 결과로 쓰지 않는다.
- **미검증**: 현재 모든 인증/대화/보관/복원 경로의 새 E2E, 실제 브라우저에서의 다중 이동·재접속 정렬 왕복, 익명 identity linking 전체 왕복, 만료 데이터 발생 후의 Cron 실행 이력, 벤또 홈의 실제 로그인 상태 렌더(로컬은 DB 미연결이라 비로그인 상태로만 확인했다).
- 이번 작업에서 **한 것**: 앱 코드 변경(위 4개 커밋), 운영 DB에 `move_saved_session` 적용, pg_cron 설치·예약 등록. **하지 않은 것**: 새 Vercel 배포, main 병합, 기존 데이터 변경, 유료 모델 호출.
