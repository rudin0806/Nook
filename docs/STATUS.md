# Nook 현재 상태 — 2026-09-16 실사 기준

이 문서가 현재 진척도의 기준이다. 과거의 미구현·미배포 문구를 현재 상태로 재사용하지 않는다. [이전 STATUS 원문](reviews/2026-09-16-status-history.md)은 이력으로 보존했다.

## 기준 버전과 운영 배포

- 운영: https://nook-nine-eta.vercel.app/
- 현재 배포: `dpl_387H51i2jBD3BP3iAQGMbp7j4bA3`, **READY / production**. 이번 Vercel 조회로 두 운영 별칭 연결을 확인했다.
- 코드 보존 브랜치: `codex/restore-node-navigation-and-shelf-order-20260916`.
- 실사 기준 커밋: `56f09e46ee671fa1a16d924fb8bf22348865f5ea`. 뒤따르는 이번 커밋들은 문서 정리다.
- main: `65f9e6323d72c191caab35c338e466f2ea2c70ea`. **main은 최신 운영 기능 코드가 아니다.** 최신 브랜치가 존재한다는 사실과 main 병합은 별개다.
- 선행 프롬프트 브랜치: `codex/claim-fidelity-five-20260916` / `f5aefa929194e4c0f9731fd2e6778314c85ca017`.
- vivid 디자인 보존 브랜치: `codex/recover-vivid-nook-ui-v2-20260916` / `8c199e1a6b18c0674028c626652d7bd4b2d64122`. 현재 운영 디자인 기준으로 사용하지 않는다.
- 운영 배포는 파일 업로드 방식이다. Vercel metadata에 Git SHA가 없어 **특정 커밋과 전체 배포 파일의 byte 단위 일치가 증명된 것은 아니다**. 이전 실행의 업로드·커밋 기록으로 연결한 기준이며 향후 재현 가능한 Git 기반 릴리스가 필요하다.

## 6개 작업의 실제 상태

| 항목 | GitHub 구현 | 운영 반영 | 검증 근거 / 남은 범위 |
| --- | --- | --- | --- |
| 1. 프롬프트 실제 응답 최소 확인 → 배포 | claim-fidelity 프롬프트·평가기·테스트 있음 | 이전 작업의 운영 배포 완료 기록 있음 | 사용자가 전달한 5개 실제 응답 검토 완료 기록 유지. 이번 실사에서 모델 재호출하지 않음. 같은 평가를 다시 미구현으로 분류하지 않음 |
| 2. 대화 시작 → 종료 → 저장 | UI·시작/승인/대화/보관 API·DB RPC 구현됨 | 해당 코드가 운영 배포 묶음에 포함됨 | 이전 실제 대화 실행·보관 데이터·로그인된 목록 조회 증거 있음. 이것을 모든 실패/익명/OAuth/복원 경로 통과로 확대하지 않음. 미구현 아님 |
| 3. 노드 클릭 → 과거 대화 → 현재 복귀 | 구현·GitHub 보존 완료 | 복구 후 운영 재배포 완료 | 이전 작업 보고에 12/12 회귀, 운영 이동/복귀·모바일 2열·키보드·모션 감소·Anchor 지원 확인. 이번에 재실행하지 않았다는 이유로 완료 이력을 취소하지 않음 |
| 4. 책장 드래그·순서 편집·저장 | UI·PATCH API·RPC·migration 구현·보존 완료 | 앱과 운영 DB 반영 완료 | 타입/린트/빌드, 운영 목록 조회, 단일 카드 RPC 성공 후 rollback 기록 있음. 다중 카드 드래그·재접속 정렬 실사용 검증 미완료. 아래 결함 보완 필요 |
| 5. 책 상세 탐색·카드 넘김 고도화 | 기본 상세 조회·구간 페이지 이동·질문 재시작 있음 | 기본 구현 배포됨 | 고도화는 아직 구현 안 됨. 기본 상세 조회에 현재 schema 회귀 결함 확인. 기존 구현을 전부 미구현으로 취급하지 않음 |
| 6. 닉네임·익명→로그인 후 저장 복귀 | Google OAuth/linkIdentity·동일 사용자 검사·익명 생성 기반 있음 | 인증 기반 코드 배포됨 | 닉네임 편집은 없음. 로그인 성공은 /drawer 고정 이동, 보관 UI는 새 창 로그인 링크만 제공. 원래 보관 화면 자동 복귀·선택 유지 미구현 |

완료율 %를 제시하지 않는다. 기능 수와 통합 검증 수준이 다르며, “코드 있음 / 운영 배포됨 / 사용자 흐름 검증됨”은 서로 다른 상태다.

## GitHub에 이미 기록된 기능 지도

| 영역 | 구현 내용 | 대표 코드 |
| --- | --- | --- |
| 시작 | 입력·초점 선택·시작 질문 생성·수정/승인 | src/components/nook/thought-input.tsx, src/app/api/start/, src/engine/start-flow.ts |
| 대화 | Safety→Judge→C/D, SHIFT 승인/거절, 종료/구간 전환 | src/app/api/conversation/route.ts, src/lib/api/conversation.ts, src/engine/conversation.ts |
| 노드 이동 | 메시지 연결, 선택 노드 재클릭 복귀, Anchor | src/components/nook/conversation-panel.tsx, src/lib/api/conversation-context.ts, src/schemas/conversation.ts |
| 보관 | 남기기/버리기, Branch 별도 선택, 휴지통·복원·질문 삭제 | src/components/nook/conversation-retention.tsx, src/lib/supabase/retention.ts, src/app/api/sessions/ |
| 복귀 | 임시 대화 목록·승인 전 제안 복구·세션 복귀 | src/components/nook/recovery-list.tsx, src/components/nook/resume-panel.tsx, src/app/api/recovery/ |
| 연결 재시작 | 승인 질문·남긴 질문·초기 입력에서 새 세션, 출처 링크 | src/app/restart/, src/components/nook/restart-panel.tsx, src/components/nook/session-origin.tsx |
| 책장 정렬 | drag/drop, 위/아래 버튼, 취소/저장 | src/components/nook/drawer-contents.tsx, src/app/api/sessions/order/route.ts |
| 상세 | 승인 노드·유효 clarification·10구간씩 조회 | src/components/nook/saved-story-contents.tsx, src/lib/retention/story-query.ts |
| 인증 | Google UI, Kakao 내부 어댑터, PKCE·identity linking·로그아웃·오류 구분 | src/lib/auth/, src/app/api/auth/, src/components/nook/account-panel.tsx |
| 익명 기반 | CAPTCHA 토큰 요구·서버 생성·동일 사용자 검증 | src/lib/auth/anonymous.ts, src/lib/supabase/anonymous.ts |
| 자동 정리 기반 | secret·환경·활성화 조건을 확인하는 실행 API | src/app/api/cron/retention/route.ts, src/lib/retention/maintenance.ts |
| 평가·가드 | 모델 allowlist·출력 검증·요청 제한·환경 점검 | src/engine/, src/prompts/, scripts/, tests/, supabase/tests/ |

익명 생성 모듈의 존재가 실제 CAPTCHA UI 연결·공급자 설정·익명 공개 운영 검증 완료를 의미하지 않는다. Cron API 존재도 예약 등록·정상 실행을 의미하지 않는다.

## 확인된 결함과 다음 작업

### 우선 수정할 회귀

1. **책 상세 조회 schema 불일치**: savedSessionListItemSchema는 shelf_position을 필수 nullable 필드로 받지만 story-query.ts의 SELECT는 이를 누락한다. 반환 객체의 parse가 실패한다. 이번에 같은 필드 구성의 최소 입력으로 invalid_type / shelf_position을 재현했다. 운영 HTTP 요청을 실행해 본 결과는 아니며 코드 계약 결함 확인이다.
2. **책장 50개 초과 처리 누락**: saved 목록은 50개만 읽고 페이지 버튼을 숨긴다. RPC는 사용자 전체 SAVED 집합을 요구하므로 51개 이상이면 정렬 저장이 실패하고 뒤 기록도 조회할 수 없다.
3. **정렬 충돌 방지 설명 과장**: RPC는 저장 시점의 ID 집합을 검사하지만 순서 revision/원래 순서를 비교하지 않는다. 동일 집합의 동시 정렬은 마지막 쓰기가 앞선 순서를 덮는다. 집합 검사와 UPDATE 사이의 동시 변경도 잠금·경쟁 회귀검사 필요. “다른 탭 변경은 모두 409”라는 기존 설명은 부정확하다.
4. **정렬 저장 중 상호작용·응답 확인**: busy 상태에서도 draggable이 켜져 있고 이동 함수에 busy guard가 없다. 클라이언트 acknowledgement는 배열 길이만 확인하고 ID와 순서 일치를 확인하지 않는다. 저장 표시와 실제 DB 순서 불일치 방지 보완 필요.

### 기능 고도화

- 5번: 위 상세 회귀를 먼저 해결하고 내부 질문/구간 탐색·카드 전환 모션·모바일/키보드·reduced-motion 검증.
- 6번: 닉네임 입력/검증/저장/재조회, OAuth 후 원래 보관 선택으로 복귀, 선택한 질문 유지, 취소·만료·다른 계정 충돌 처리.
- 인증에서는 익명 사용자 ID를 유지하는 identity linking 원칙을 지킨다. 이메일 문자열로 계정을 합치거나 기록 소유자를 임의 변경하지 않는다.

### 출시·운영 후속

- 다중 카드 정렬→저장→새로고침·재접속, 다른 계정 접근 거절, 동시 변경 회귀.
- 익명 시작→로그인→보관의 실제 왕복은 별도 인수 관문. 완료된 일반 대화/노드 기능을 다시 구현할 이유가 아니다.
- Cron 예약·활성화·실행 이력은 이번 실사에서 확인하지 않았다. 과거 문서상 미등록이며 API만으로 가동을 주장하지 않는다.
- Kakao 공급자/버튼 공개·브랜딩은 기존 별도 후속 항목.
- 최신 브랜치 CI/전체 테스트·main 병합·배포와 Git 커밋 매핑 정리. 이번 조회에서 해당 브랜치 workflow run 목록은 비어 있었다. 과거 단위 테스트 수를 이번 HEAD의 전체 회귀 결과로 표시하지 않는다.

## 운영 DB 적용 이력

이번 원격 migration 조회에서 **12건**을 확인했다. 10건/미적용이라는 과거 문구는 현재 상태가 아니다.

| 이름 | 원격 버전 |
| --- | --- |
| nook_core_schema | 20260912000918 |
| nook_access_and_retention | 20260912000940 |
| fix_temporary_expiry_nullable | 20260912001339 |
| harden_retention_rls_and_indexes | 20260912011744 |
| validate_final_branch_sources | 20260913003147 |
| ai_request_admission | 20260914090858 |
| approve_start_question | 20260914090912 |
| start_api_persistence | 20260914093022 |
| conversation_runtime | 20260915015038 |
| session_recovery_and_restart | 20260915015057 |
| closure_choice | 20260915123746 |
| saved_session_shelf_order | 20260916063642 |

저장소 정렬 파일명은 20260916050000_saved_session_shelf_order.sql이다. 파일명과 원격 버전 차이를 알고 적용 이력을 대조해야 하며 중복 적용하지 않는다. 보안 advisor 경고는 이전 점검에 남아 있으며 “DB 적용 완료”가 “보안 경고 0”을 뜻하지 않는다.

## 증거와 검증 범위

- **이번 직접 확인**: GitHub 브랜치/HEAD/트리 및 관련 파일, Vercel 운영 READY·별칭, 원격 migration 12건, 상세 schema 최소 재현.
- **이전 직접 실행 기록**: 3·4 작업 시 타입·린트·빌드 통과, 운영 홈/로그인된 책장 조회, health 200, 해당 시점 오류 로그 0, 단일 카드 정렬 RPC rollback.
- **이전 대화에서 전달된 완료 보고**: 프롬프트 실제 5개 검토, 노드 이동 12/12·운영 왕복. 이전 완료 증거로 유지하되 이번 재실행 결과로 쓰지 않는다.
- **미검증**: 현재 모든 인증/대화/보관/복원 경로의 새 E2E, 다중 카드 정렬 왕복, 익명 identity linking 전체 왕복, Cron 실행 이력.
- 이번 작업은 문서 실사·갱신이다. 앱 코드 변경, 새 배포, 데이터 변경, 유료 모델 호출은 하지 않았다.
