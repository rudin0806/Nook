# 첫 승인 이후 대화 연결

첫 Node 승인 후 `/talk/[nodeId]`로 진입한다. GET/POST `/api/conversation`은 인증된 Node 소유권으로 세션을 찾는다. POST는 같은 출처, 요청 크기/schema, 별도 rollout flag, 사용자별 요청량 제한과 HMAC 중복 검사를 거친다.

Safety → 안전 발화 저장 → 종료 의사/구조 상한 → Judge → C/D → 원자적 결과 저장 순서다. STOP 원문은 DB에 전달하지 않으며 HANDOFF는 Message 저장 후 종료한다. Shift 제안은 승인 대기 상태로만 보관하고, 승인할 때 Node·Edge·근거를 함께 기록한다. 거절은 현재 질문을 유지한다. Branch 승격과 최종 보관 선택은 독립적이다.

CLOSE 및 구간 전환의 계속/종료 선택을 구현했다. 종료 후 세션/Branch 각각 보관 선택은 기존 retention RPC로 연결한다. 익명 사용자는 계정 연결이 필요한 경우 기존 소유자를 연결하는 새 로그인 창을 열 수 있다. 계정 연결의 실제 복귀 검증은 별도다.

`conversation_runtime`와 `conversation_receipts`는 세션 삭제에 CASCADE하며 클라이언트 변경 권한이 없다. 요청 완료 결과는 원자적으로 기록돼 중복 요청이 모델을 다시 호출하지 않는다. 생성 실패 전에 안전한 사용자 Message가 저장됐을 수 있으므로 같은 요청 결과 확인과 현재 기록 새로고침을 제공한다. 변경된 version의 이전 제안은 승인할 수 없다.

화면에는 최근 대화와 HIGH로 저장된 유효 Clarification 최대 3개를 보여준다. 과거 질문은 세션당 한 번이며 승인 전 Node/Edge 카운터는 증가하지 않는다. 입력/출력의 크기·컨텍스트 상한을 넘어가면 실패하며 내용을 임의로 잘라 모델에 전달하지 않는다.

## 검증

- 로컬 전체 단위 테스트 132/132, `npm run validate`(타입·린트·빌드) 통과.
- [독립 DB 및 전체 CI](https://github.com/rudin0806/Nook/actions/runs/34861101286) 통과. 신규 SQL은 교차 소유권, 제안/승인 분리, 오래된 version, 외부 근거 롤백, 구간 Anchor 계승, CLOSE confidence null, 종료·STOP/HANDOFF를 검사한다. 최초 SQL CASE 문법과 첫 질문 길이 경계 테스트 오류는 수정한 뒤 통과했다.
- 첫 원문 입력은 5,000자, 승인 질문은 Judge main_question과 동일한 1,000자다. 경계 회귀를 갱신했다.
- 로컬 프로덕션 HTTP 4건: 잘못된 이야기 UUID 404, 유효 형식 이야기 HTML 200, 잘못된 API UUID 400, 비활성 API 503. 응답은 no-store다. 실제 사용자 소유 기록 조회 성공을 뜻하지 않는다.
- 브라우저 설치는 배포 파일의 인증서 검증 오류(UnknownIssuer)로 실패했다. 인증서 검증을 끄지 않았으며 실제 클릭·시각 검증은 미완료다.

## 실제 생성 평가

[최초 실행](https://github.com/rudin0806/Nook/actions/runs/34861101378): Sol high, 출력 상한 2048, 자동 재시도 없음. 기존 6개 fixture 중 SHIFT 3건 생성 후 J-NOT-01에서 중단했다. 7호출, 입력 28,997·출력 2,381토큰. [기준선 원본](conversation-generation-baseline.json)을 보존했다. 완주나 품질 통과로 기록하지 않는다. 다음 실행에는 고정 단계/오류 코드만 추가해 원문이나 공급자 내부 오류를 노출하지 않고 실패 원인을 구분한다.

[두 번째 진단](https://github.com/rudin0806/Nook/actions/runs/34861979752)은 첫 J-SHIFT-01에서 `JUDGE_OUTPUT_INVALID`로 중단됐다(1호출, 입력 5,582·출력 460토큰). [구조 진단 실행](https://github.com/rudin0806/Nook/actions/runs/34862366847)은 같은 사례의 `clarifications` 배열이 기존 최대 3개 제한을 넘긴 것을 확인했다(1호출, 입력 5,582·출력 510토큰). 원본은 [오류 코드](conversation-generation-diagnostic.json), [구조 진단](conversation-generation-schema-diagnostic.json)에 보존했다. 첫 배치의 오류는 당시 세부 진단이 없어 동일 원인이라고 단정하지 않는다.

Prompt B v4.2에는 기존 Zod 계약의 Clarification 최대 3개, Branch 최대 5개, 근거 최대 10개·중복 금지를 명시했다. 출력 제한이나 정답 fixture를 느슨하게 바꾸지 않았으며, 잘못된 모델 결과를 잘라 저장하지 않는다. C/D 6건과 기존 Judge 전체 32건을 재평가했다.

최초 SHIFT 3개 문구는 사용자 근거 범위 안에 있으나 “내가 원하는 건 …일까?” 형태의 확인 질문이 많아 중심 질문의 명료성과 유용성에 검토 여지가 있다. 자동 형식 통과는 독립적인 의미 품질 승인과 다르다.

### 수정 후 C/D 결과

[최종 생성 실행](https://github.com/rudin0806/Nook/actions/runs/34862734761), 코드 `9a95a93`: **6/6 사례 완주**, Judge 예상 경로 일치, 출력 schema·참조 검증 통과, 구조 진단 0건. Sol high 실제 12호출, 입력 47,954·출력 3,998토큰. [최종 원본](conversation-generation-final.json)을 보존했다. 동일 코드의 [전체 CI](https://github.com/rudin0806/Nook/actions/runs/34862734818)도 통과했다.

Codex가 기존 사용자 발화와 6개 문구를 대조했다. D의 세 질문은 현재 중심 질문 안에서 조건/장면/사용자가 제시한 과거와 현재를 묻고, 확인되지 않은 감정·성향을 추가하지 않았다. J-NOT-01의 70만원은 확정 저장이 아닌 가정 조건으로 쓰였다. J-MED-03의 과거 사람 만나는 업무는 U3에 존재한다. C의 J-SHIFT-03은 디자인/무게로 전환한 근거를 유지했으나 나머지 C 두 질문은 확인형 문구가 반복돼 유용성·어투 검토 여지가 있다. 이번 결과는 생성 경로와 형식의 소표본 검증이며 긴 실제 대화·독립 사용자 품질 승인·다른 모델의 성능을 뜻하지 않는다. 원본의 `semanticReview: PENDING`은 별도 사람 승인 전 상태로 유지한다.

### Judge 전체 회귀 — 병합 차단 1건

[전체 실제 평가](https://github.com/rudin0806/Nook/actions/runs/34862734837)는 32/32 호출을 완주했지만 strict **30/31**, action 30/31로 실패했다. `J-CLOSE-01`만 정답 CLOSE 대신 REFLECT/LOW였고 나머지 strict 30개는 통과했다. 경계 J-SHIFT-04는 strict 분모에 포함하지 않는다. 입력 180,778·출력 13,769토큰. [원본 보고서](conversation-judge-regression.json)를 보존했다. 이전 Prompt B v4.1의 31/31은 역사적 단일 실행 결과이며 최신 v4.2 결과로 표시하지 않는다.

이 사례의 마지막 발화에는 “지난달에 신규 기능 기획 잠깐 도왔을 때”라는 새 경험과 “회사가 싫은 게 아니라 반복되는 일이 싫은 거였어”라는 자기 구분이 함께 있다. RULES §8.1은 마지막 응답에 새 정보가 없음을 필수로 하고 매 턴 새 정보가 있으면 계속 보도록 한다. EVALSET의 J-CLOSE-01 및 fixture는 현재 질문의 답을 스스로 냈으므로 CLOSE를 요구한다. 새 경험이 자기 구분의 근거일 때도 계속 질문할지, 정리 제안을 우선할지 기준 확인이 필요하다.

AGENTS.md의 문서 충돌 시 사용자 확인 규칙에 따라 이 의미를 임의로 결정하거나 fixture를 바꾸지 않았다. 사용자 결정 뒤 RULES/EVALSET/Prompt B를 일치시키고 J-CLOSE-01·J-EDGE-01·짧은 새 정보 사례를 먼저 검사한 뒤 전체 회귀를 진행한다. 따라서 CI의 정적 검사 성공과 C/D 6건 완주에도 **PR 병합은 보류**다.

## 운영과 남은 범위

새 migration의 운영 적용·환경변수 변경·기능 활성화·새 배포·PR 병합은 실행하지 않았다. 익명 계정 연결 후 원래 이야기 복귀, 실제 생성/승인/보관의 브라우저 전체 왕복, 남겨둔 질문에서 새 이야기 시작, 자동 삭제 예약 운영 검증이 남았다. UX/UI 재정비, 카카오 로그인, 브랜딩 공개는 사용자 인지 미결 항목으로 유지한다.

### 배포 전 적용 순서

1. 운영 migration 이력과 새 `20260914145756_conversation_runtime.sql`의 미적용 여부를 확인한 뒤 적용한다. 독립 DB 통과를 운영 적용 성공으로 기록하지 않는다.
2. 검증 환경에서 기존 Supabase·OpenAI·HMAC·사이트 출처 설정과 `NOOK_REFRAME_*`, `NOOK_REFLECT_*`, Judge/Safety 모델 설정을 확인한다. 비밀 값은 로그나 문서에 복사하지 않는다.
3. 검증 환경의 시작·대화 API만 활성화하고 Google 로그인 → 첫 입력 → 승인 → 일반 응답 → Shift 승인/거절 → 종료 → 보관 → 생각더미 상세를 확인한다. 제안 거절, 두 탭의 오래된 승인, 오류 후 같은 요청 확인도 검증한다.
4. 익명 공개는 CAPTCHA·요청량 보호와 identity linking 검증을 마친 뒤 별도로 결정한다. 테스트 모델 후보를 운영 기본값으로 자동 확정하지 않는다.
5. 최신 평가 결과와 전체 왕복 증거를 검토한 뒤 PR 병합·운영 공개를 판단한다.
