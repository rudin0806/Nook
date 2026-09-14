# 작업 상태

기준일: 2026-09-14. PR #2 작업 브랜치에 main `65f9e63`을 동기화한 상태다. 동기화는 main에 PR #2 전체를 병합했다는 뜻이 아니다.

## 제품과 첫 배포

Next.js 16.3.4 / React 19.3.0 / TypeScript strict / npm. SEED React, Supabase, OpenAI, Zod 기반 초기화 및 첫 화면·`/api/health` 구현. 운영 주소는 https://nook-nine-eta.vercel.app 이다. 최초 배포 검증 기록이 있으며 이번 동기화에서 운영 화면을 재검증하지 않았다.

PRD v2.3의 홈 `지나온 생각`, 익명 미보관 즉시 폐기, HANDOFF Message 저장 규칙을 유지한다. HANDOFF 상태는 기존 `HANDOFF_STOPPED`이며 제공 문서의 `COMPLETED`와 차이는 별도 검토 대상이다. `focus_required` 확인 질문 담당은 사용자 요청으로 보류한다.

## DB — main·운영 적용 완료 범위

main에는 migration 5개가 있다. PR #4의 신규 환경 REVOKE 보완, PR #5의 지연 Branch 출처 검사 수정이 병합됐다. Nook 원격에도 삭제 수정까지 적용됐으며 원격 삭제 연쇄·RLS 재검증은 통과했다. 이번 동기화에서 운영 DB를 변경하지 않았다.

- [DB 재현 기록](reviews/2026-09-12-db-replay.md): 독립 PGlite에서 초기 적용, 보조 함수 유무 검사 및 보관/RLS 검증.
- [삭제 연쇄 기록](reviews/2026-09-13-deletion-chain.md): 원본·질문·계정 삭제, 새 세션 2개 보존, Anchor 보호. 원격 적용 후 결과는 [PR #5](https://github.com/rudin0806/Nook/pull/5)에 기록됐다.
- 저장소/원격 migration 버전은 일부 다르다. 새로 적용하거나 버전을 바꾸기 전에 대응 이력을 확인한다. 삭제 수정 파일 `20260913001728`의 원격 버전은 `20260913003147`이다.
- 기존 authenticated SECURITY DEFINER 경고 9건은 유지된다. 소유권 테스트 통과가 모든 보안 검증 완료를 뜻하지 않는다.
- 만료 경계 SQL 테스트 통과: 만료 시각 이전 보호·정각 삭제, SAVED 보호, SAFETY_STOPPED 만료, 일반 사용자 호출 거절, 반복 실행 안전성을 독립 PGlite에서 확인했다. **자동 삭제 예약은 가동하지 않는다.** 예약 설정·실행 이력 검증은 남았다.
- 전체 Supabase reset, 실제 Auth/HTTP API·동시성 검증은 남았다.

## AI — PR #2에 구현, Sol high Judge strict 31/31

- 사용자 결정에 따라 모델 후보는 `gpt-5.6-luna / terra / sol`로 제한하고 Astra는 평가·운영 후보에서 제외한다. 코드와 평가 trigger가 이 allowlist를 강제한다. reasoning effort도 `low / medium / high`만 허용하고 실행 보고서에 기록한다.
- 공통 hedge 계산: 전체 사용자 발화로 비율 계산, 최소 5턴·0.7 기준, 중복 ID 거절, 일치 패턴 반환.
- C-03-pre: Prompt B, Judge Zod 출력 검증, MEDIUM 사유와 결정론적 채점기.
- [C-02 통합](reviews/2026-09-13-C-02-integration.md): Prompt D의 REFLECT 전용 요청 준비, MEDIUM 사유 전달, PAST 제한·출력 검증.
- [모델 평가기](reviews/2026-09-13-judge-model-runner.md): Responses API 연결, 출력·호출 수 제한, 에러 중단, 원문 없는 구조 보고서. GitHub Actions와 JSON trigger 모두 모델·reasoning·최대 호출·출력 상한을 검증한다.
- GitHub Actions의 `AI_API_KEY` secret을 평가 실행 때만 `OPENAI_API_KEY`로 전달한다. `gpt-5.6-sol` 핵심 관문은 J-CLOSE-01=`CLOSE`, J-EDGE-01=`SHIFT/HIGH`로 2/2 통과했다([run 34757408510](https://github.com/rudin0806/Nook/actions/runs/34757408510)). 입력 6,009·출력 636토큰이었고 실행 시점 공개 단가 기준 약 $0.037이다.
- Responses API 입력은 명시적 `user`/`input_text` 배열이며, JSON mode 검증을 위해 사용자 입력에도 JSON 출력 요구를 넣었다. 유료 push trigger는 strict schema, 중복 ID 거절, 최대 32호출·호출당 4096 출력토큰 상한을 거친다.
- [Sol 32건 기준선](reviews/2026-09-13-judge-sol-baseline.md)은 strict 20/31(64.5%)이었다. [보수성 조정과 최종 회귀](reviews/2026-09-14-judge-sol-tuning.md) 후 `gpt-5.6-sol` reasoning high에서 strict **31/31**, action 31/31, 오류 0을 기록했다([run 34795136112](https://github.com/rudin0806/Nook/actions/runs/34795136112)). boundary `J-SHIFT-04`는 `REFLECT/MEDIUM` 분포로 별도 기록했다. 입력 178,602·출력 13,945토큰, uncached 단가 상한 약 $0.993이다.
- 최종 결과는 결정론적 fixture 채점 1회 통과다. reference/examples 의미 동등성 사람 검토와 실제 대화 회귀 전까지 실사용 정확도를 보장하지 않는다. Sol high를 Judge 품질 기준 후보로 두되 Terra/Luna 동일 조건 비교 전에는 최저 비용 운영 모델을 확정하지 않는다.
- [Judge 런타임 어댑터](reviews/2026-09-14-judge-runtime-adapter.md)는 서버 소유 세션과 최신 창·carryover를 대조하고, 전체 세션은 hedge 계산에만 사용한다. 모델은 Luna/Terra/Sol, reasoning은 low/medium/high, 출력은 최대 2048토큰으로 제한한다. Responses 요청은 `store: false`, SDK 자동 재시도 0회이며 검증된 구조 결과만 반환한다.
- 런타임 어댑터는 내부 서버 모듈까지만 구현했다. 공개 API Route는 만들지 않았다. Safety → 명시적 종료 의사 → 구조 상한을 선행하고 사용자·세션 소유권과 원자적 DB 저장을 묶는 상위 처리 흐름이 남았다.
- Prompt C v2는 내부 서버 어댑터 통합 완료, 실제 모델 평가와 사용자 확인·저장 연결은 남았다. 실제 사용자 대화에 대한 Safety/종료/상한→Judge→C/D→저장 연결은 미구현이다.

## 평가 계약과 보류

Judge 32 / Start 17 / Safety 15. Judge boundary는 J-SHIFT-04 하나이며 pending은 0이다. carryover 사유 2건과 Safety category 계약 8건은 해결됐다. 2026-09-14의 최신 GitHub 검증에서 `npm run eval:validate`는 issues 0으로 통과했다. 이전 PR 본문의 불일치 10건 실패 기록은 과거 상태다.

[이전 파일 검증 기록](reviews/2026-09-12-document-validation.md)의 carryover 사유 누락 2건은 C-03-pre에서 해결됐고, Safety HANDOFF 상태·문구 및 분류 계약도 후속 구현에 반영됐다. examples/reference 의미 검토, hedge 임계값 적정성과 새 경계 사례 검토는 남았다.

## 앱 API — PR #2에 구현, 실제 인증 왕복 검증 전

[보관·휴지통 API](reviews/2026-09-13-retention-api.md)를 추가했다. 로그인 사용자는 진행 중·생각더미·휴지통 기록과 남겨둔 질문을 조회하고, 완료 기록 보관 확정·휴지통 이동·복원·질문 영구 삭제를 요청할 수 있다. Route Handler는 Supabase secret key 없이 인증 쿠키와 RLS/RPC를 사용한다. 입력 크기·UUID·페이지 범위를 검증하고 DB 내부 오류는 공개하지 않는다.

보관 API 계약 테스트 5개와 Judge 런타임 테스트 5개를 포함해 단위 테스트 46개가 통과했다. 실제 익명 로그인·Google/Kakao identity linking·배포 환경 HTTP 검증과 화면 연결은 남았다.

## 다음 업무

1. 익명 로그인 초기화·보관 선택 복귀 연결. Google/Kakao identity linking·OAuth callback은 구현됐으며 공급자 설정과 실제 왕복 검증이 남았다.
2. 보관·휴지통·복원 API를 실제 화면에 연결하고 배포 환경에서 HTTP/RLS 왕복 검증.
3. 삭제 예약 적용 준비. 만료 경계 테스트는 완료했다.
4. Safety·종료 의사·구조 상한 뒤에 Judge 런타임을 연결하고, 사용자·세션 소유권·원자적 구조 로그 저장·요청량 제한을 통합 검증.
5. Prompt C 모델 평가, Safety 계약 해결, Terra/Luna 비용 비교 후 검증된 변경을 순차 병합.

협업 역할과 최소 전달 방식은 [HANDOFF.md](HANDOFF.md)를 따른다. 오래된 체크포인트보다 이 문서의 현재 상태를 우선한다.

## 2026-09-14 UI 피드백 및 서랍 조회

- 사용자 요청으로 첫 문구를 `무슨 생각 하고 있었어요?`, 주 메뉴를 `이야기 나누기 / 생각더미`으로 변경했다. 제품 표기 우선순위는 PRD 말미의 UI 피드백 결정을 따른다.
- `/preview`: 둥근 입체 카드·버튼, 서랍 예시 목록, 질문 확인 및 경로 시안. 실제 AI/저장과 분리된 예시 화면이다.
- `/drawer`: 기존 보관 세션/질문 API 조회 연결, 응답 스키마 검사, 로그인 필요·조회 실패·빈 목록·페이지 이동 및 요청 취소 처리. 목록은 세션 날짜와 보관 질문을 표시하며, 세션 상세 경로·복원·삭제 화면은 미구현이다.
- 타입·린트·프로덕션 빌드 통과. 실제 Auth/DB HTTP 왕복 및 브라우저 시각 검증은 미완료다. 계정 연결 없이 사용 가능한 AI 대화 완성본을 뜻하지 않는다.
- 다음 독립 작업은 인증 초기화·OAuth 연결과 서랍 실제 계정 검증. Prompt C 수정본 수령 뒤 Safety 계약·시작 질문 생성과 함께 대화 전체 경로를 연결한다.

## UI 명칭 정정 및 레퍼런스 반영

보관 화면의 최종 이름은 **생각더미**다. 이전 작업 기록의 서랍은 폐기된 화면 명칭이며, `/drawer`는 기존 기술 경로로만 유지한다. Fabric 구성(큰 카드·여백·플로팅 메뉴)과 Tolan 컨셉(부드러운 공간·말풍선·친근한 형태)을 사용자 제공 이미지 기준으로 반영했다. CSS 구름 오브젝트는 Nook 시안용이다. API 호출·저장 기능 상태는 이전과 같고, 예시 데이터임을 화면에 표시한다.

## Prompt C v2 구현

[통합 기록](reviews/2026-09-14-prompt-c-integration.md). SHIFT/HIGH 호출 제한, 현재 창·carryover 원문 검증, 제안 출력 스키마·동일 질문 거절, 서버 SDK 호출과 오류 중단 구현. 신규 테스트 6개와 타입·린트·빌드 통과. 실제 모델 호출 0회. 공개 대화 API·사용자 승인·DB 저장 및 Safety 전체 연결은 미완료다.

## 인증 연결 구현

[인증 구현·설정·검증 기록](reviews/2026-09-14-auth-flow.md). 로그인 화면, Google/Kakao 시작, 익명 identity linking, PKCE callback, 이 기기 로그아웃 및 생각더미 로그인 안내를 연결했다. 인증 단위 테스트 6개·프로덕션 HTTP smoke 7개·타입·린트·빌드 통과. 실제 공급자 로그인과 운영 RLS 왕복은 미검증이며 익명 세션 생성 및 보관 선택 복귀 연결은 남았다. 운영 설정·DB 변경·유료 AI 호출은 없다.

## Google 우선 로그인 검증

사용자가 Google 공급자 설정 완료를 알렸다. 카카오는 후반에 연결하기로 했으며 `/login`에서 카카오 버튼을 숨겼다. 카카오 어댑터 코드는 유지한다. Google 실제 OAuth 왕복·익명 identity linking 성공은 별도 검증 전이다. Vercel 조회에는 최초 운영 배포 1개만 있어 최신 로그인 코드는 아직 운영에 반영되지 않았다.

## 2026-09-14 첫 입력·승인 공개 Route 연결

[최신 구현·운영 적용·검증 기록](reviews/2026-09-14-start-api.md). `/api/start`, `/api/start/focus`, `/api/start/approve`를 인증·요청 제한·Safety·서명·원자적 저장에 연결했다. 기존 요청 제한/승인 migration은 운영 적용을 확인했으며 새 저장 함수 migration도 적용했다. 103개 테스트, 독립 DB 회귀, 운영 DB rollback 테스트, 타입·린트·빌드 및 비활성 HTTP 검증 통과.

이번 직접 실행에서 `eval:validate`는 issues 0, Safety 15개 매핑으로 통과했다. 위의 Safety 8건 실패 표기는 과거 문서 기록이며 현재 실행 결과가 아니다. fixture/정답은 이번에 변경하지 않았다. 실제 Safety/Start 품질 평가와 제품 의미 검토 완료를 뜻하지 않는다.

운영 API 활성화·새 Vercel 배포·입력 화면 버튼 연결은 아직 하지 않았다. `NOOK_START_API_ENABLED`와 모델/HMAC 설정, 실제 인증·모델·DB HTTP 왕복 검증이 남았다. 운영 환경변수의 실제 값/존재 여부는 이번 도구로 확인하지 못했다.

## 2026-09-14 첫 입력 화면 연결

[화면 연결 기록](reviews/2026-09-14-start-ui.md). 기존 입력 화면을 첫 입력·초점 선택·질문 승인 API에 연결했다. 질문 수정, 승인 확인, Safety 안내, 로그인 필요, 횟수 제한 및 동일 요청 재확인을 표시한다. API 공개 설정이 꺼져 있으면 시작 버튼은 비활성화된다. 전체 테스트 110개 및 타입·린트·빌드 통과. 브라우저 설치 오류로 실제 클릭/시각 검증은 미완료이며, 실제 모델 평가·로그인 전체 왕복·운영 활성화·배포도 남아 있다. 이번 작업은 디자인 전면 개편이나 DB 변경을 포함하지 않는다.


## 2026-09-14 실제 Safety·Start 평가

[실행·수정·운영 확인 기록](reviews/2026-09-14-start-safety-baseline.md). 실제 호출에서 발견한 JSON 요청 형식 오류를 공통 어댑터에서 수정했다. 최초 완주 기준선은 Safety label 14/15·Start 14/17이었으며, 기존 정답은 유지한 채 프롬프트의 구분을 보완했다.

Sol high 최종 회귀는 Safety label/category/behavior 각각 **15/15**, Start label **17/17**. provider 오류·위험 미탐·잘못된 STOP/HANDOFF·mapping 불일치·자동 금지어 위반 0건. 전체 테스트 **113/113**, 타입·린트·빌드·정적 fixture 검사 및 독립 DB 회귀 통과. 이 결과는 기존 fixture의 분류 평가이며 Node 0 생성·문구 의미·추가 경계·실사용 정확도까지 보장하지 않는다.

운영 브라우저는 이전 홈의 비활성 시작 버튼과 비로그인 생각더미의 계정 연결 안내를 확인했다. Google 로그인 완료·identity linking·입력에서 실제 저장까지의 왕복은 아직 미검증이다. 운영 배포·환경변수 변경·기능 활성화·PR 병합은 하지 않았다.

바로 진행할 후속 개발은 Node 0 생성 평가와 최신 코드 preview 배포 준비·필수 환경변수 확인이다. 실제 Google 로그인에는 사용자 참여가 필요하다. 운영 모델/reasoning과 익명 시작 공개 여부는 이번 품질 기준선만으로 확정하지 않는다. 위 검증 공백을 해소하기 전에는 병합·운영 공개를 보류한다.

## 2026-09-14 Node 0 평가 및 생각더미 상세 후속 개발

[Node 0 평가 기록](reviews/2026-09-14-node-zero-evaluation.md). Sol high 실제 생성 11건을 두 차례 실행했다. 최초 자동 검사 통과 뒤 의미 검토에서 발견한 후속 질문 치환·중첩 이유 질문·메일 시제 오류를 v2에서 보완했다. 재평가 자동 11/11, 해당 오류는 이번 표본에서 해소. 막연한 입력의 질문 유용성과 어투 검토는 남으며 의미 품질의 독립 사람 승인 또는 실사용 정확도 통과를 뜻하지 않는다.

기존 생각더미에는 이미 휴지통 이동·복원·질문 삭제 화면 연결이 있었다. 이번에는 `/drawer/[sessionId]`와 `/api/sessions/[sessionId]/story`를 추가했다. 사용자가 보관한 완료 세션의 승인된 중심 질문과 유효 Clarification을 구간·질문 순서로 읽는다. Anchor를 다시 Node로 표시하거나 대화 전문·미승인 AI 제안·내부 Judge 로그를 내려주지 않는다. 10구간씩 조회하며 사용자 쿠키 인증과 기존 RLS, SAVED 부모 검사, 조회 후 보관 상태 재검사, 응답 schema 검사·no-store를 적용한다. 새 DB migration은 없다. UI의 로그인 필요·조회 실패·빈 기록·재시도·이전/다음 구간을 구현했다.

새 조회 테스트 5개를 포함해 전체 단위 테스트 121/121, 타입·린트·빌드·변경 소스 formatter·정적 평가 계약 issues 0 통과. 기본 CI도 이제 전체 단위 테스트를 실행한다. 로컬 서버는 명시적 loopback host로 실행됐지만 별도 실행기의 HTTP 연결은 `fetch failed`로 실패했다. HTTP/브라우저 검증 성공으로 기록하지 않는다. 인증된 실데이터와 새 상세 화면의 브라우저 왕복 검증은 별도 관문이다.

### 사용자 인지 미결 항목

1. UX/UI 재정비 — 전체 디자인과 문구 최종 검토. 현재 기능 연결은 전면 개편 완료가 아니다.
2. 카카오 로그인 연결 — 기존 어댑터는 있고 공급자 설정·버튼 공개·실제 로그인/identity linking 검증이 남았다.
3. 브랜딩 공개 절차 — Google 표시 이름·검증/게시와 필요 시 도메인 변경. 사용자 요청으로 별도 진행한다.

### 개발·검증 미결 항목

- 일반 대화 API의 Safety·종료·상한 → Judge → C/D → 사용자 확인 → 원자적 저장 연결.
- 종료 화면의 기록/질문 보관 선택, 익명 세션 초기화·계정 연결 후 보관 복귀, 남겨둔 질문에서 새 이야기 시작.
- Prompt C/D 실제 생성 평가, Node 0 추가 경계·다중 초점 선택 뒤 생성과 문구 검토, 모델 비용 비교.
- 최신 코드 검증용 배포·필수 환경변수 확인과 Google 로그인 → 입력 → 승인 → 보관/조회/휴지통/복원 전체 왕복.
- 자동 삭제 예약의 운영 검증·활성화 준비.
- 운영 모델/reasoning·익명 공개 범위 결정 후 병합·운영 활성화 판단.

사용자는 localhost로 돌아가던 로그인 문제를 해결했다고 알렸다. 동일 문제 재설정은 요청하지 않는다. 전체 저장 경로 검증을 완료했다는 뜻은 아니다. 브랜딩은 보류하되 기능 개발은 계속한다.
