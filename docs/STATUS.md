# 작업 상태

기준일: 2026-09-13. PR #2 작업 브랜치에 main `65f9e63`을 동기화한 상태다. 동기화는 main에 PR #2 전체를 병합했다는 뜻이 아니다.

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

## AI — PR #2에 구현, Sol 32건 기준선 확보

- 공통 hedge 계산: 전체 사용자 발화로 비율 계산, 최소 5턴·0.7 기준, 중복 ID 거절, 일치 패턴 반환.
- C-03-pre: Prompt B, Judge Zod 출력 검증, MEDIUM 사유와 결정론적 채점기.
- [C-02 통합](reviews/2026-09-13-C-02-integration.md): Prompt D의 REFLECT 전용 요청 준비, MEDIUM 사유 전달, PAST 제한·출력 검증.
- [모델 평가기](reviews/2026-09-13-judge-model-runner.md): Responses API 연결, 기본 핵심 2개 사례·출력 제한·에러 중단·원문 없는 보고서.
- GitHub Actions의 `AI_API_KEY` secret을 평가 실행 때만 `OPENAI_API_KEY`로 전달한다. `gpt-5.6-sol` 핵심 관문은 J-CLOSE-01=`CLOSE`, J-EDGE-01=`SHIFT/HIGH`로 2/2 통과했다([run 34757408510](https://github.com/rudin0806/Nook/actions/runs/34757408510)). 입력 6,009·출력 636토큰이었고 실행 시점 공개 단가 기준 약 $0.037이다.
- Responses API 입력은 명시적 `user`/`input_text` 배열이며, JSON mode 검증을 위해 사용자 입력에도 JSON 출력 요구를 넣었다. 유료 push trigger는 strict schema, 중복 ID 거절, 최대 32호출·호출당 4096 출력토큰 상한을 거친다.
- [Sol 32건 기준선](reviews/2026-09-13-judge-sol-baseline.md): API 오류 없이 32/32 완료, strict 20/31 통과(64.5%). False Positive Shift·MEDIUM→HIGH·금지어 위반은 0이지만, 놓친 SHIFT 4·MEDIUM→LOW 6·Branch 실패 1이 있어 보수성 조정이 필요하다. 입력 95,434·출력 10,405토큰, uncached 단가 상한 약 $0.590.
- Prompt C는 Claude 산출물 대기. 실제 사용자 대화에 대한 Safety/종료/상한→Judge→C/D→저장 연결은 미구현이다.

## 평가 계약과 보류

Judge 32 / Start 17 / Safety 15. Judge boundary는 J-SHIFT-04 하나이며 pending은 0이다. 정적 fixture 오류는 해결했지만 Safety category 계약 불일치 8건은 남아 있다. `npm run eval:validate`는 이 불일치 때문에 실패하며 숨기거나 임의로 정답을 바꾸지 않는다.

[이전 파일 검증 기록](reviews/2026-09-12-document-validation.md)의 carryover 사유 누락 2건은 C-03-pre에서 해결됐다. examples/reference 의미 검토, Safety HANDOFF 상태·문구 및 분류 계약, hedge 임계값 적정성과 새 경계 사례 검토는 남았다.

## 앱 API — PR #2에 구현, 실제 인증 왕복 검증 전

[보관·휴지통 API](reviews/2026-09-13-retention-api.md)를 추가했다. 로그인 사용자는 진행 중·생각더미·휴지통 기록과 남겨둔 질문을 조회하고, 완료 기록 보관 확정·휴지통 이동·복원·질문 영구 삭제를 요청할 수 있다. Route Handler는 Supabase secret key 없이 인증 쿠키와 RLS/RPC를 사용한다. 입력 크기·UUID·페이지 범위를 검증하고 DB 내부 오류는 공개하지 않는다.

계약 테스트 5개를 포함해 단위 테스트 38개가 통과했다. 실제 익명 로그인·Google/Kakao identity linking·배포 환경 HTTP 검증과 화면 연결은 남았다.

## 다음 업무

1. 익명 로그인 초기화와 Google/Kakao identity linking·OAuth callback 구현.
2. 보관·휴지통·복원 API를 실제 화면에 연결하고 배포 환경에서 HTTP/RLS 왕복 검증.
3. 삭제 예약 적용 준비. 만료 경계 테스트는 완료했다.
4. Judge 실패 11건 subset으로 Prompt B의 보수성을 조정하고 핵심 대조쌍 회귀 후 32건을 재평가.
5. Claude Prompt C 검토, Safety 계약 해결, 검증된 변경을 순차 병합.

협업 역할과 최소 전달 방식은 [HANDOFF.md](HANDOFF.md)를 따른다. 오래된 체크포인트보다 이 문서의 현재 상태를 우선한다.
