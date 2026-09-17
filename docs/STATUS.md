# Nook 현재 상태 — 2026-09-17

기능 상태의 단일 기준. 과거 완료는 새로 평가하지 않았다는 이유로 취소하지 않는다.

## 버전·배포

- 저장소: rudin0806/Nook, 작업·배포 브랜치 **main만 사용**.
- 기능 기준 커밋: `0da1941`. 최신 책장 UI 커밋 `bdd98745` (`feat(ui): restore bookshelf view for saved stories`), 운영 `dpl_HbE8Ys6sHMiPp14yG8s7JuMAhxJt` READY, source git. main과 운영 일치 확인.
- 기능 변경: 5번 상세 탐색, 6번 계정·보관 복귀, 정렬 동시성, 잔여 UI와 익명 확인 UI를 GitHub main과 운영에 반영했다. GitHub 쓰기 권한을 복구했고 Vercel 자동 배포가 새 SHA를 기록했다.
- 최신 UI 변경: `bdd98745`에서 보관한 이야기(`sessions`)를 책장형 책등 그리드로 복원했다. 운영은 `dpl_HbE8Ys6sHMiPp14yG8s7JuMAhxJt`이며 main의 해당 SHA를 source git으로 사용한다.
- 운영: https://nook-nine-eta.vercel.app/
- Vercel GitHub 연결 완료. main push → 자동 운영 배포. 파일 업로드 배포를 사용하지 않는다.

## 기능 상태

| 항목             | 구현·기존 배포                                  | 이번 변경·확인                                                                                                                     |
| ---------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1 프롬프트       | 실제 응답 5개 검토·운영 완료 이력 유지          | 엔진·프롬프트 변경 및 유료 평가 없음                                                                                               |
| 2 시작→종료→보관 | 기존 UI/API/DB 및 운영 실행 이력 유지           | 익명 사용자 확인 위젯 연결 추가. 외부 CAPTCHA 설정·실제 익명 왕복은 아래 운영 관문                                                 |
| 3 노드 이동      | 구현·운영 완료                                  | 기존 12/12 회귀·모바일/키보드/Anchor 완료 이력 유지                                                                                |
| 4 책장 정렬      | 한 권 이동·20권 페이징·상한 없는 정렬 배포 완료 | 같은 목록 조회 시점의 전체 책장 fingerprint를 비교, 변경 시 409. 이동 성공 후 새 fingerprint와 위치 반영. SQL stale/권한 회귀 통과 |
| 5 상세 탐색      | 기본 상세·재시작 배포 완료                      | 구간·질문 목차, 개별 카드, 버튼/좌우키/스와이프, reduced-motion 구현                                                               |
| 6 계정           | Google OAuth/linkIdentity 기반 배포 완료        | 닉네임 저장·재조회, 로그인 후 보관 화면 복귀, 선택 복원·취소·만료·다른 계정 차단 구현                                              |

## 이번 구현

- 닉네임: `PATCH /api/auth/profile`, 인증된 비익명 사용자만 변경. Supabase `user_metadata.nickname`에 표시 정보로 저장하며 권한에 사용하지 않는다. 1~20자, NFC 정규화, 제어·방향 전환 문자/마크업 거절. 변경 응답 확인 후 성공 표시.
- 보관 복귀: `/resume/:sessionId?retention=1`만 허용. OAuth callback URL은 기존 설정 그대로 유지. flow cookie에 returnTo를 보관하고 만료 안내용 별도 cookie는 인증 근거로 사용하지 않는다.
- 선택 유지: sessionStorage에 사용자 ID·세션 ID·Branch ID·10분 만료만 저장. 같은 계정/세션·유효 질문만 복원하고 저장은 사용자 재확인 후 실행한다. 기록 원문이나 토큰은 저장하지 않는다.
- 진행 중 대화도 명시적 retention 복귀 요청이면 보관 화면을 연다. SAVED/TRASHED/만료·소유권 판정은 서버가 먼저 처리한다.
- 이어갈 대화: dialog 카드 레이아웃, 가로 스와이프·좌우키·버튼, 만료로 카드 수가 줄었을 때 인덱스 보정. 빈 상태 점선 카드 3장 구분 강화.
- globals.css 잔여 다크 하드코딩을 테마 토큰으로 교체. 기존 팔레트·벤또·상단탭·책등 유지.
- 보관한 이야기 책장: 데스크톱은 20권 페이지를 10권×2줄로, 모바일은 5권×4줄로 배치한다. 책등 hover/focus 시 단일 권 미리보기가 앞으로 올라오며 클릭/Enter는 완료 세션 상세(`/drawer/[sessionId]`)로 이동한다. 순서 편집 모드는 기존 drag/arrow 목록을 유지하고 질문·휴지통 컬렉션은 기존 카드 UI를 유지한다. reduced-motion도 지원한다.
- 옛 `/api/sessions/order`와 전체 배열 클라이언트·스키마·서버 함수 제거. DB의 옛 `reorder_saved_sessions(uuid[])` RPC 삭제 migration은 작성했지만, 현재 Codex 사용량 한도로 Supabase 적용이 대기 중이다.
- 익명 시작: 선택적 Turnstile UI·만료/오류 처리·토큰 전달 추가. `NEXT_PUBLIC_TURNSTILE_SITE_KEY`와 서버의 익명 활성화가 함께 필요하다. 실제 검증은 Supabase Auth가 담당한다.

## DB·동시성

- 이전 운영 migration 13건 + `shelf_conflict_guard` 적용 완료 = 14건.
- `saved_thought_sessions.shelf_revision`: RLS가 적용된 단일 SELECT snapshot에서 읽는 전체 책장 ID/자리 fingerprint. 사용자 데이터 변경 없음.
- `move_saved_session_checked`: 사용자별 잠금 후 fingerprint 비교, 일치할 때 기존 한 권 이동 함수 실행. 반환 위치·새 fingerprint 검증.
- fingerprint는 단조 증가 revision이 아니다. 다른 탭 변경 뒤 현재 순서가 원래와 완전히 같아졌다면 충돌로 취급하지 않는다. 예전 2인자 move RPC는 새 앱의 충돌 검사와 구별된다.
- 운영 DB에서도 합성 사용자·책 2권을 넣은 트랜잭션으로 stale 요청 거절, 이후 최신 요청 성공, 타 사용자·익명 거절을 확인했다. 전부 rollback, 실제 사용자 데이터 변경 없음.
- 새 함수 추가와 옛 RPC 삭제를 묶은 최초 요청은 자동 승인 검토가 배포 전 삭제 위험으로 거절했다. 삭제를 분리한 호환 migration은 승인·적용됐다.

## 검증

- 단위 테스트 **157/157** (2026-09-17 재실행), `npm run validate` (타입·린트·프로덕션 빌드) 통과.
- 독립 Postgres(PGlite): migration 14개, SQL suite 10개, release readiness 11 checks PASS. 기존 60권 순서 회귀 포함.
- `npm run eval -- --dry`, `npm run eval:judge:validate` 통과. 유료 모델 호출 **0회**.
- Cron 최근 3회(2026-09-16 11:17/12:17/13:17 UTC) `succeeded`. `1 row`는 SELECT 반환 행 수이며 삭제 건수가 아니다. 실제 만료 대상 처리 건수 관찰은 미완료.
- 운영 공개 홈 로드, 제목·주 메뉴·입력·조명·책장·이어갈 대화 영역 렌더링 확인. 최신 책장 배포 `dpl_HbE8Ys6sHMiPp14yG8s7JuMAhxJt`는 READY이고 source git SHA가 `bdd98745`와 일치한다. 최근 1시간 Vercel runtime error 0건. 로그인 공급자·모바일 실기기 왕복과 책장 hover/focus 시각 확인은 아래 운영 관문으로 남긴다.
- Codex 브라우저의 실제 hover/모바일 캡처는 세션 사용량 제한으로 실행하지 못했다. 코드·타입·린트·빌드·단위 테스트·배포 상태까지 확인했으며, 다음 담당자가 운영 브라우저에서 시각만 마무리하면 된다.

## 남은 운영 관문·제품 결정

- Turnstile 사이트 키, Supabase 대응 secret·CAPTCHA 강제·익명 활성화 설정 확인. 기존 모델 호출 완료를 취소하는 항목이 아니다.
- 실제 Google OAuth 취소/성공 및 익명 identity linking 전체 왕복. 테스트 코드 통과를 실제 공급자 왕복으로 보고하지 않는다.
- 실제 여러 권 브라우저 이동·재접속 순서, 모바일 터치·reduced-motion 기기 검증. 책장 10×2/5×4 노출, hover/focus 전면 미리보기, 클릭/Enter 상세 이동도 운영 브라우저에서 확인한다.
- 만료 데이터 발생 후 Cron 처리 관찰. 예약 실행 자체는 성공 확인했다.
- Kakao 공급자 공개는 기존 별도 후속이며 현재 UI는 Google만 제공.
- 예시 칩은 사용자 요청으로 제거됐지만 PRD §4/§19 문구 정정은 사용자 결정 대기. 임의로 되살리거나 PRD 요구를 바꾸지 않는다.

## 과거 근거

- [직전 문서 보존](reviews/2026-09-16-before-completion.md): 이전 실사/Claude 변경 이력. 그 안의 미배포·main 불일치는 현재 상태가 아니다.
- [초기 이력](reviews/2026-09-16-status-history.md), [Judge 평가](reviews/2026-09-14-judge-sol-tuning.md).
- 이전 유료 Judge Sol high strict 31/31 유지. 이후 추가 7개 fixture의 실제 유료 실행 포함 여부는 미확인.
