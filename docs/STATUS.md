# 최신 작업 — 2026-09-15 종료 제안 기준 반영

사용자가 RULES §8.1 변경을 승인했다. Prompt B v4.3, 종료 거절 문맥 전달, CLOSE→READY 시 선택 보존 migration을 구현했다. Judge fixture는 35건(3건 추가), J-CLOSE-03은 단순 반복이므로 REFLECT/LOW로 계약 변경했다. 이전 30/31과 아래의 기준 확인 보류는 역사적 기록이다. 제품 결정은 완료됐고 새 계약의 실제 모델 평가는 미실행이다.

API 연결·유료 모델 평가·배포·운영 migration 적용은 사용자 요청에 따라 후속 작업으로 남긴다. 코드 배포 전에 closure_choice migration을 적용해야 한다. 새 필드를 읽는 코드만 먼저 배포하지 않는다. 보관 기간/생각 더미/휴지통 정책은 변경하지 않았다.

검증: 오프라인 테스트 150/150, eval:validate issues 0, Judge fixture 35건 정합성, 타입·린트·빌드 통과. 독립 메모리 PostgreSQL에서 전체 migration 및 보관·복구·삭제·종료 선택 SQL 회귀 통과. 종료 반복 억제의 의미 판정은 프롬프트에 의존하며 실제 모델 평가는 아직 하지 않았다. PR 병합은 실제 모델 품질 및 운영 왕복 검증 전까지 보류한다.

---

# 작업 상태

기준일: 2026-09-15. PR #2 작업 브랜치에 main `65f9e63`을 동기화한 상태다. 동기화는 main에 PR #2 전체를 병합했다는 뜻이 아니다.

## 2026-09-14 개발 상태 — 첫 승인 이후 대화 연결

이번 PR에는 `/talk/[nodeId]`와 인증된 대화 API를 추가했다. Safety → 안전 입력 저장 → 종료/구조 상한 → Judge → C/D → 결과 저장, Shift 승인·거절, 구간 전환, 종료 후 기록/질문 보관 선택이 연결됐다. 아래 날짜별 기록 중 “일반 대화 미구현”은 이전 체크포인트다. 최신 세부 범위와 검증은 [대화 연결 기록](reviews/2026-09-14-conversation-runtime.md)을 따른다.

전체 단위 테스트 132/132, 타입·린트·빌드와 독립 DB 회귀를 통과했다. 실제 C/D 평가에서 발견한 Judge 출력 개수 제한 누락을 보완한 뒤 6/6 사례 생성이 완주했다(Sol high 12호출). 문구의 유용성·독립 의미 검토와 운영 전체 왕복 완료는 별도다. 최신 Judge 전체 회귀는 strict **30/31**로 실패했고 J-CLOSE-01의 종료 기준 해석 확인이 필요하다. 아래 이전 31/31은 역사적 결과다.

새 대화 migration은 독립 DB에서만 검증했다. 운영 적용, 새 환경변수/기능 활성화, 검증용 배포, Google 로그인부터 대화·보관까지의 실데이터 왕복은 남았다. PR 병합과 운영 공개는 아직 보류다.

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

새 조회 테스트 5개를 포함해 전체 단위 테스트 121/121, 타입·린트·빌드·변경 소스 formatter·정적 평가 계약 issues 0 통과. 기본 CI도 이제 전체 단위 테스트를 실행한다. 코드 `96c62c4`의 [GitHub 검증 및 독립 DB 회귀](https://github.com/rudin0806/Nook/actions/runs/34854312412)가 모두 통과했다. 별도 실행기의 HTTP 연결 실패 뒤 서버와 요청을 같은 실행기에서 실행해 HTTP smoke 4건을 확인했다: 잘못된 UUID/음수 offset은 400·no-store, 상세 HTML은 200·제목 표시·private no-store, 설정 없는 API는 503·no-store. 실제 로그인과 보관 데이터 조회 성공을 뜻하지 않는다. 인증된 실데이터와 새 상세 화면의 브라우저 클릭/시각 검증은 별도 관문이다.

### 사용자 인지 미결 항목

1. UX/UI 재정비 — 전체 디자인과 문구 최종 검토. 현재 기능 연결은 전면 개편 완료가 아니다.
2. 카카오 로그인 연결 — 기존 어댑터는 있고 공급자 설정·버튼 공개·실제 로그인/identity linking 검증이 남았다.
3. 브랜딩 공개 절차 — Google 표시 이름·검증/게시와 필요 시 도메인 변경. 사용자 요청으로 별도 진행한다.
4. 새 경험을 말하며 자기 구분을 마친 경우의 종료 제안 기준 — RULES §8.1과 J-CLOSE-01 정답의 해석 정렬이 필요하다. 기존 정답을 임의로 바꾸지 않았다.

### 개발·검증 미결 항목

- 일반 대화 API 연결은 구현됐다. 실제 모델 품질과 인증된 HTTP/DB 전체 왕복 검증이 남았다.
- 종료 화면의 기록/질문 보관 선택은 구현됐다. 계정 연결 후 보관 복귀의 실제 검증과 남겨둔 질문에서 새 이야기 시작은 남았다.
- Prompt C/D 실제 생성 평가, Node 0 추가 경계·다중 초점 선택 뒤 생성과 문구 검토, 모델 비용 비교.
- 최신 코드 검증용 배포·필수 환경변수 확인과 Google 로그인 → 입력 → 승인 → 보관/조회/휴지통/복원 전체 왕복.
- 자동 삭제 예약의 운영 검증·활성화 준비.
- 운영 모델/reasoning·익명 공개 범위 결정 후 병합·운영 활성화 판단.

사용자는 localhost로 돌아가던 로그인 문제를 해결했다고 알렸다. 동일 문제 재설정은 요청하지 않는다. 전체 저장 경로 검증을 완료했다는 뜻은 아니다. 브랜딩은 보류하되 기능 개발은 계속한다.

## 2026-09-15 보관·복귀·재시작 구현

이 단락이 위 날짜별 구현/미구현 기록보다 우선한다. 제품 규칙은 PRD와 RULES §12, 데이터 연결은 ERD의 2026-09-15 보완을 따른다.

- 중간 저장 버튼 없이 AI 정리 제안의 남기고 마치기/더 생각하기, 언제든 나가기의 남기고 나가기/남기지 않고 나가기/돌아가기를 연결했다. 서버가 받아들인 기록을 AI 요약 대기 없이 보관하며 늦은 출력은 마감 상태를 변경할 수 없다.
- 홈에서 여러 임시 대화를 질문·만료 시각과 함께 복귀한다. 승인 전 시작 제안도 서버에서 복구하며 새로운 모델 호출은 하지 않는다. 첫 질문 승인 전 남긴 세션은 원래 입력으로 표시한다.
- 일반 계정 대화의 24시간 만료는 휴지통 이동, 그 만료 시각부터 7일 뒤 삭제로 바뀐다. 익명·Safety·KEPT 개별 삭제 예외는 유지한다. 읽기와 종료 자체는 TTL을 갱신하지 않는다.
- PENDING Branch, 생각 더미의 승인 Node, KEPT 질문, 승인 전 보관 입력에서 연결된 새 세션을 시작한다. 원래 세션의 보관 여부·기한은 바꾸지 않는다. 원본 삭제 시 자식 세션은 유지된다.
- 새 migration과 화면은 개발 브랜치 기준이다. 운영 DB 적용·Cron 활성화·배포·실제 로그인 왕복은 미실행이다. 실제 Judge 30/31의 CLOSE 해석 보류는 이 변경으로 해결된 것이 아니다.

타입·린트·빌드, 오프라인 137개, 독립 SQL 7개와 선택적 보조 함수 권한 검사를 통과했다. 로컬 HTTP는 화면 응답·잘못된 식별자·Origin 차단과 DB 미설정 시 데이터 미노출만 확인했다.

세부 인수 기준과 이번 검증 기록: [보관·복귀 구현](reviews/2026-09-15-retention-recovery.md).

## 2026-09-15 운영 사전 점검 후속

[운영 사전 점검](reviews/2026-09-15-release-preflight.md)을 추가했다. 운영 DB는 적용 이력 8건·세션 0건·Cron 미설치이며 새 대화/보관 migration 2건은 미적용이다. 자동 승인 검토가 운영 DB 변경을 명시적 승인 부족으로 거절해 변경은 실행되지 않았다. 읽기 전용 적용 점검 SQL 11개와 공개 경로 점검 명령 `npm run release:check -- --url …`를 추가했다. 독립 DB에서는 11개 모두 충족, 운영은 미적용에 따라 모두 미충족이다. Vercel health 200은 DB·모델·대화 기능의 준비 완료를 뜻하지 않는다.

## 2026-09-15 운영 DB 적용 완료

사용자가 운영 DB 변경 2건을 명시적으로 승인한 뒤 적용했다. 앞선 자동 승인 거절·미적용 기록은 이전 체크포인트다.

| 저장소 migration                            | 원격 적용 버전 |
| ------------------------------------------- | -------------- |
| 20260914145756_conversation_runtime         | 20260915015038 |
| 20260915011312_session_recovery_and_restart | 20260915015057 |

운영 이력은 총 10건이며 읽기 전용 테이블/RPC 권한 검사 11개가 모두 통과했다. 인증 정보 없는 authenticated 요청은 새 소유자 전용 RPC 3개에서 모두 거절됨을 트랜잭션 롤백 검사로 확인했다. 새 테이블의 서버 전용 데이터 접근을 열지 않았다.

Advisor는 authenticated SECURITY DEFINER WARN 12건(기존 9 + 소유자 전용 RPC 3), 서버 전용 테이블 RLS/no-policy INFO 4건이다. 경고를 없애려고 공개 권한을 추가하지 않았으며, 이번 권한 검사가 전체 보안 검증 완료를 뜻하지 않는다.

자동 정리 Cron 등록·실행, 새 Vercel 배포, 실제 로그인·대화·복귀·보관 통합 검증은 아직 미실행이다. AI CLOSE 기준 1건과 PR 병합 보류도 유지한다. 이번 승인 범위는 DB migration 2건이다.


## 후속: Preview 배포 및 연결 점검

2026-09-15, PR 소스 기준 `9a42fc5c550cf7bd251bd57aba23f1a94566bba7`에서 파일 업로드 방식으로 Preview를 배포했다. Vercel Git 연결/metadata가 SHA를 증명하는 배포는 아니다.

- Preview: https://nook-ivnpjoaml-suzie990806-3166.vercel.app
- 배포 ID: `dpl_AKygBMeRmpCHZgeqqDuALDntMUFY`, READY. 운영 배포는 변경하지 않았다.
- 첫 배포는 업로드 묶음에 `eval/safety_mapping.json`이 누락돼 빌드 실패했다. 해당 런타임 데이터를 포함한 114개 파일로 재배포하여 빌드가 성공했다. 다음 업로드에서도 src/public뿐 아니라 이 파일을 반드시 포함해야 한다.
- 커넥터 GET `/api/recovery`: 503 `SERVICE_NOT_CONFIGURED`. Preview의 Supabase 클라이언트 초기화가 실패했다. 우선 Preview 범위의 `NEXT_PUBLIC_SUPABASE_URL` 및 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 설정을 확인하고 재배포해야 한다. 이 응답만으로 운영 DB 장애나 누락된 변수 하나를 확정하지 않는다.
- 다른 GET 점검은 Vercel 보호 계층의 302 인증 리다이렉트로 종료됐다. 일부 최초 병렬 요청은 공유 URL 생성 충돌(409)이 있었고 순차 재시도에서도 인증 리다이렉트였다. 앱의 정상 200/400/401 확인으로 계산하지 않는다.
- 사용 가능한 Vercel 연결 도구에는 환경변수 조회/수정 기능이 없고 로컬 Vercel 인증도 없어 환경 설정 수정은 수행하지 못했다. 보호 설정을 임의로 해제하지 않았다.
- 다음 실행 순서: Preview 환경변수 및 canonical origin/OAuth callback 구성 확인 → 재배포 → 인증된 브라우저로 Google 로그인/대화/복귀/보관/복원/연결 재시작 검증 → 자동 정리 예약과 운영 배포 별도 진행.
- 전체 완성도 추정: 핵심 기능 구현 약 85%, 출시 준비 약 65~70%. 측정된 진척률이 아닌 남은 작업과 검증 위험을 반영한 판단이다. UX/UI 재정비, 카카오 로그인, 브랜딩 공개, AI CLOSE 기준 1건이 남아 있으며 PR 병합 보류를 유지한다.

## Preview 로그인 주소 자동 선택

Preview에서 `VERCEL_ENV=preview`인 경우 Vercel 서버 환경변수 `VERCEL_URL`의 배포 호스트를 사용한다. 운영/로컬에서는 기존 `NOOK_SITE_URL`을 유지한다. 로그인·콜백·로그아웃, AI 요청, 직접 보관 POST에 같은 정책을 적용했다. 요청의 Host/Forwarded 헤더는 주소 선택에 쓰지 않는다. 잘못되거나 누락된 Preview 호스트는 운영 주소로 대체하지 않고 거절한다.

Vercel 시스템 환경변수 접근이 필요하며, Supabase Redirect URLs에 검증 대상 배포의 정확한 `/api/auth/callback` 주소를 추가해야 한다. 이 변경이 Supabase 허용 목록을 자동 변경하지는 않는다. 별도 도메인 구매는 필요 없다. Vercel Standard Deployment Protection과 VERCEL_URL 조합의 공식 문서상 제한도 배포 전 확인 대상이다.

참고: https://vercel.com/docs/environment-variables/system-environment-variables

## 사용자 로그인 확인 및 오류 처리 보완

사용자가 Google Client Secret 교체 후 Preview 로그인이 해결됐다고 확인했다. 대상 Preview는 `nook-wgpupzziu-suzie990806-3166.vercel.app`, 배포 `dpl_C3kuuWcZaYDRKV6v6nGxgxrJuDu5`이며 소스 기준은 `76c6bc7`이다. 실제 대화·보관 전체 통합 검증 완료를 뜻하지 않는다.

후속 코드에서 인증 취소/공급자 오류/시도 만료/코드 교환/사용자 조회/동일성 실패를 구분한다. 로그에는 고정된 실패 단계만 남기고 외부 오류·인증 코드·사용자 식별자는 기록하지 않는다. 로그인 오류 리다이렉트에 빈 fragment를 명시하여 외부 인증 정보의 주소창 상속을 막는다. NextResponse의 Location 보존을 회귀 테스트했다. 이 후속 변경은 아직 배포하지 않았다.

미결: 실제 AI 실행 환경변수·모델 선택 및 기능 활성화, 자동 정리 예약 적용/검증, AI CLOSE 기준 1건, UX/UI 재정비, 카카오 공급자 설정, 브랜딩 공개. 사용자 직접 테스트는 별도로 진행하며 새 배포를 반복해 테스트 주소를 바꾸지 않는다. PR 병합은 보류한다.

## 만료 정리 실행 API 개발

`/api/cron/retention`을 추가했다. 비밀키 인증과 운영 환경/활성화 플래그를 모두 만족해야 기존 만료 정리 함수를 호출한다. Preview에서는 실행을 거절한다. 실패·불확실한 실행 결과는 성공으로 표시하지 않으며 자동 재시도하지 않는다. 설정 예시와 운영 활성화/중단 절차는 [정리 작업 문서](reviews/2026-09-15-retention-scheduler.md)에 기록했다. 예약 후보는 하루 1회이며 실제 예약은 미등록이다. 운영 데이터 삭제·새 배포는 수행하지 않았다.

## AI 실행 환경 사전 점검

`release:env` 명령을 추가했다. 필수 서버 키·공개 DB 연결·배포 주소·6개 모델 역할의 설정과 시작/대화 활성화 상태를 구분한다. 런타임과 모델 설정 스키마를 공유한다. 입력값이나 Zod 오류 원문은 출력하지 않는다. 로컬 실행에서 설정 부재를 확인했으며 이는 Vercel 원격 설정 상태의 증거가 아니다. 실제 키 유효성·AI 호출은 검사하지 않는다. 전체 오프라인 테스트 149개 통과. 모델 선택과 운영 기능 활성화는 변경하지 않았다.
