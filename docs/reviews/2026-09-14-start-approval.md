# 첫 질문 승인 저장

## 구현 범위

- `issueStartReceipt`: Safety/start coordinator의 PROPOSAL 또는 CLEAR_AS_IS 결과에만 서버 서명을 발급한다. 사용자·세션·안전 검사 후 저장된 최초 Message·제안문·만료 시각을 묶는다. 후보/미승인 Node는 DB에 저장하지 않는다. 만료는 해당 세션 임시 만료 이내로 호출자가 정하며 최대 24시간이다.
- 서명은 암호화가 아니다. 질문이 포함되므로 응답 본문/요청 본문으로만 전달하고 로그·URL·브라우저 영구 저장소에 남기지 않는다. 발급 함수는 신뢰된 서버 호출자 전용이다.
- `approveServerStartQuestion`: getUser로 확인한 사용자의 승인 요청을 처리한다. 요청 본문의 user_id는 받지 않는다. RLS 쿠키 클라이언트로 원본 Message와 ACTIVE/TEMPORARY 세션을 확인한다.
- 그대로 승인하면 모델을 다시 호출하지 않는다. 수정문이면 원본을 문맥으로 Moderation + Safety classifier를 다시 실행한다. STOP/HANDOFF는 노드를 저장하지 않고 상위 Safety 처리 흐름으로 반환한다. 원문이 담긴 오류는 노출하지 않는다.
- `approve_start_question`: 사용자 요청 잠금 → 소유 세션 잠금 → 첫 Segment 잠금. 미만료 요청·서명 만료·원본 Message·첫 노드 여부를 재검증한다. 승인 Node 삽입, 기존 트리거의 node_count 증가, 요청 SUCCEEDED/result_id 저장이 하나의 트랜잭션이다.
- 같은 요청은 결과 참조만 재사용한다. 다른 요청 ID로 첫 질문을 다시 승인해도 두 번째 START를 만들 수 없다. 응답 유실 시 같은 요청 ID로 상태를 조회/재전송해야 하며 자동으로 새 요청을 만들지 않는다.
- 승인 처리도 기존 논리 요청 5/분·50/UTC일·동시 1건 제한을 거친다. 최초 입력 요청과 승인 요청은 서로 다른 요청이며 모델 호출 개수와는 다르다.

## 검증

- 단위 테스트: 서명 변조·사용자 변경·만료·키 교체, 중복/제한 응답의 호출 생략, 수정문 Safety, 저장 오류 및 응답 유실 시 재실행 금지.
- 전체 migration 7개를 독립 PGlite에 적용. 기존 삭제 연쇄·만료·보관 RLS 회귀와 신규 승인 테스트 통과.
- SQL 테스트는 Node insert 이후 요청을 만료시키는 테스트 전용 트리거로 트랜잭션 전체 롤백을 확인한다. 테스트 트리거와 데이터는 rollback된다.
- 기존 RLS 테스트의 고정 테이블 수 13 조건은 요청 제한 테이블 2개 추가 이후 낡았다. 모든 public 테이블에 RLS가 켜져 있는지 검사하도록 수정했다.
- 타입 검사·lint·production build 통과. CI에 전체 migration PostgreSQL 17 재현과 독립 연결 12개의 동일 승인 동시 처리 검증을 추가했다. 실제 CI 결과는 해당 커밋의 Actions를 따른다.

## 아직 연결하지 않은 것

내부 서버 어댑터와 저장 RPC까지 구현했다. 공개 시작/승인 Route, Raw Thought 제출 시 Session/Segment 생성 및 Safety 통과 Message 저장, 후보 서명 발급의 실제 응답 연결, STOP/HANDOFF 세션 처리, 로그인부터 승인까지 실제 HTTP 검증은 후속 작업이다.

새 migration과 앞선 admission migration은 운영 DB에 적용하지 않았다. 공개 AI API가 없어 운영 요청 제한도 아직 활성화되지 않았다. HMAC 서버 비밀값과 운영 모델 설정 확인, 원격 migration 이력 대조 후 적용한다. 이번 작업은 유료 모델 호출이나 디자인 변경을 포함하지 않는다.
