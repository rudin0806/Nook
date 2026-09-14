# AI 요청량 제한과 중복 처리

기준: 사용자 확정 **1분 5회 / 하루 50회 / 동시 처리 1건**. 사용자 계정 ID 기준이며 IP별 제한을 대신하지 않는다. 하루는 UTC 00:00에 초기화하고, 분 제한은 첫 허용 요청부터 60초 고정 창이다. 창 경계에서는 짧은 시간에 두 창의 요청이 이어질 수 있다.

## 구현 경계

- claim_ai_request는 사용자별 제한 행을 잠가 여러 서버의 등록을 직렬화한다. 중복 확인·동시 처리 확인·차감·요청 등록은 한 트랜잭션이다.
- 실제 새 요청을 CLAIMED로 등록할 때만 차감한다. 중복·충돌·BUSY·제한 초과는 차감하지 않는다. AI 호출 실패도 이미 사용한 시도이므로 환급하지 않는다.
- 요청 키는 사용자 + request_id. 서버 HMAC은 사용자·작업 종류·검증된 payload를 묶는다. 같은 키/내용은 상태를 재조회하고, 다른 내용은 CONFLICT다.
- RUNNING / SUCCEEDED / FAILED 요청을 자동 재실행하지 않는다. 5분이 지나면 다음 claim에서 FAILED로 처리한다. 이전 실행의 늦은 완료는 token·기한 검사로 거절한다.
- 완료 응답은 결과 UUID만 저장한다. 원문·모델 출력·위험 발화는 이 원장에 저장하지 않는다. 요청 키는 계정 삭제 전까지 유지하며 계정 삭제 시 함께 삭제된다. 별도 보존 기간/정리 작업은 추가 전이며 무기한 원장 크기 증가에 유의한다.
- service_role만 RPC를 실행한다. 브라우저 역할은 테이블 조회/쓰기 및 RPC 실행 권한이 없다. withAIAdmission은 쿠키의 getUser 결과를 사용하며 body의 사용자 ID를 신뢰하지 않는다.
- NOOK_REQUEST_HMAC_SECRET은 32자 이상 별도 서버 비밀값이다. 모든 서버에서 동일하게 유지하고 임의로 회전하지 않는다. Supabase/OpenAI 키를 재사용하지 않는다.
- 이 제한은 논리 요청 수다. 한 요청 안에서 Safety/A/생성 등 여러 API 호출이 발생할 수 있으므로 API 호출 50회나 금액 상한을 뜻하지 않는다.

## 사용

공개 API에서 입력과 세션 소유권을 검증한 후 withAIAdmission({requestId, operation, body}, operation)을 사용한다.
body는 검증된 고정 필드 순서의 JSON 문자열이며 세션/턴/초점 식별자를 포함한다.
operation 안에서 Safety를 먼저 실행한다. 응답 UUID 조회 때에도 별도로 소유권을 확인한다.
RATE_LIMITED는 HTTP 429 + Retry-After, BUSY/RUNNING은 처리 중 안내, CONFLICT는 HTTP 409에 대응시킨다.

## 아직 운영에 연결하지 않은 범위

이 변경은 migration·서버 어댑터·독립 DB/단위 테스트다. 운영 migration 적용, 비밀값 설정, 공개 대화 API 배선은 별도다.
withAIAdmission만으로 메시지/노드 저장의 원자성이 생기지 않는다. 다음 저장 RPC에서 요청 token·기한 확인과 실제 저장·SUCCEEDED 전환을 같은 트랜잭션으로 묶어야 한다. 외부 API 호출과 DB 사이의 정확히 한 번 실행은 보장하지 않는다. 서버 종료/네트워크 단절은 실패/미확정으로 남기고 자동 재호출하지 않는다.
익명 계정 재발급을 이용한 제한 우회는 IP별 제한·CAPTCHA 배선에서 추가로 막아야 한다.

검증은 .github/workflows/offline-validation.yml에서 TypeScript/빌드와 테스트 전용 PostgreSQL 17로 수행한다. 실제 사용자/운영 DB/유료 AI를 사용하지 않는다.
