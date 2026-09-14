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
- Prompt C는 Claude 산출물 대기. 실제 사용자 대화에 대한 Safety/종료/상한→Judge→C/D→저장 연결은 미구현이다.

## 평가 계약과 보류

Judge 32 / Start 17 / Safety 15. Judge boundary는 J-SHIFT-04 하나이며 pending은 0이다. 정적 fixture 오류는 해결했지만 Safety category 계약 불일치 8건은 남아 있다. `npm run eval:validate`는 이 불일치 때문에 실패하며 숨기거나 임의로 정답을 바꾸지 않는다.

[이전 파일 검증 기록](reviews/2026-09-12-document-validation.md)의 carryover 사유 누락 2건은 C-03-pre에서 해결됐다. examples/reference 의미 검토, Safety HANDOFF 상태·문구 및 분류 계약, hedge 임계값 적정성과 새 경계 사례 검토는 남았다.

## 앱 API — PR #2에 구현, 실제 인증 왕복 검증 전

[보관·휴지통 API](reviews/2026-09-13-retention-api.md)를 추가했다. 로그인 사용자는 진행 중·생각더미·휴지통 기록과 남겨둔 질문을 조회하고, 완료 기록 보관 확정·휴지통 이동·복원·질문 영구 삭제를 요청할 수 있다. Route Handler는 Supabase secret key 없이 인증 쿠키와 RLS/RPC를 사용한다. 입력 크기·UUID·페이지 범위를 검증하고 DB 내부 오류는 공개하지 않는다.

보관 API 계약 테스트 5개와 Judge 런타임 테스트 5개를 포함해 단위 테스트 46개가 통과했다. 실제 익명 로그인·Google/Kakao identity linking·배포 환경 HTTP 검증과 화면 연결은 남았다.

## 다음 업무

1. 익명 로그인 초기화와 Google/Kakao identity linking·OAuth callback 구현.
2. 보관·휴지통·복원 API를 실제 화면에 연결하고 배포 환경에서 HTTP/RLS 왕복 검증.
3. 삭제 예약 적용 준비. 만료 경계 테스트는 완료했다.
4. Safety·종료 의사·구조 상한 뒤에 Judge 런타임을 연결하고, 사용자·세션 소유권·원자적 구조 로그 저장·요청량 제한을 통합 검증.
5. Claude Prompt C 검토, Safety 계약 해결, Terra/Luna 비용 비교 후 검증된 변경을 순차 병합.

협업 역할과 최소 전달 방식은 [HANDOFF.md](HANDOFF.md)를 따른다. 오래된 체크포인트보다 이 문서의 현재 상태를 우선한다.

## 2026-09-14 UI 피드백 및 서랍 조회

- 사용자 요청으로 첫 문구를 `무슨 생각 하고 있었어요?`, 주 메뉴를 `이야기 나누기 / 생각더미`으로 변경했다. 제품 표기 우선순위는 PRD 말미의 UI 피드백 결정을 따른다.
- `/preview`: 둥근 입체 카드·버튼, 서랍 예시 목록, 질문 확인 및 경로 시안. 실제 AI/저장과 분리된 예시 화면이다.
- `/drawer`: 기존 보관 세션/질문 API 조회 연결, 응답 스키마 검사, 로그인 필요·조회 실패·빈 목록·페이지 이동 및 요청 취소 처리. 목록은 세션 날짜와 보관 질문을 표시하며, 세션 상세 경로·복원·삭제 화면은 미구현이다.
- 타입·린트·프로덕션 빌드 통과. 실제 Auth/DB HTTP 왕복 및 브라우저 시각 검증은 미완료다. 계정 연결 없이 사용 가능한 AI 대화 완성본을 뜻하지 않는다.
- 다음 독립 작업은 인증 초기화·OAuth 연결과 서랍 실제 계정 검증. Prompt C 수정본 수령 뒤 Safety 계약·시작 질문 생성과 함께 대화 전체 경로를 연결한다.

## UI 명칭 정정 및 레퍼런스 반영

보관 화면의 최종 이름은 **생각더미**다. 이전 작업 기록의 서랍은 폐기된 화면 명칭이며, `/drawer`는 기존 기술 경로로만 유지한다. Fabric 구성(큰 카드·여백·플로팅 메뉴)과 Tolan 컨셉(부드러운 공간·말풍선·친근한 형태)을 사용자 제공 이미지 기준으로 반영했다. CSS 구름 오브젝트는 Nook 시안용이다. API 호출·저장 기능 상태는 이전과 같고, 예시 데이터임을 화면에 표시한다.
