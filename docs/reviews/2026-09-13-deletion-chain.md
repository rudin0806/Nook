# 삭제 연쇄 검증

기준 main: aeea2d49e1ae66fec8380447f39e1ad0003cd8db. 테스트는 독립 PGlite PostgreSQL 엔진에서 수행했다. 운영 DB 적용·원격 데이터 삭제는 하지 않았다.

## 재현한 결함

기존 4개 migration을 적용한 뒤 원본 세션을 지우면 `BRANCH_SOURCE_MUST_BE_NULL_TOGETHER`가 발생했다. 보관 질문의 source_session_id/source_segment_id/source_node_id를 세 FK가 차례로 SET NULL 처리한다. 지연 제약 트리거는 각 UPDATE 당시의 NEW 값을 보존하므로, 종료 시점에도 중간 상태를 검사하고 정상적인 삭제를 거절했다.

CLI 2.117.0으로 생성한 `20260913001728_validate_final_branch_sources.sql`은 기존 migration을 변경하지 않고 검증 함수를 교체한다. 각 이벤트의 NEW.id로 현재 Branch 행을 다시 읽어 최종 상태를 검사한다. 계정 CASCADE 등으로 행 자체가 삭제됐으면 검사할 행이 없으므로 종료한다. 소유자·세션·구간·노드 일치 조건과 함수 권한은 유지한다.

## 검사 결과

| 시나리오                                                 | 결과                                                |
| -------------------------------------------------------- | --------------------------------------------------- |
| 원본 세션 먼저 삭제                                      | 보관 질문 유지, 출처 FK 3개 NULL, PENDING 후보 삭제 |
| 같은 보관 질문에서 시작한 세션 2개                       | 원본 삭제 이후 둘 다 유지                           |
| 보관 질문 삭제 RPC                                       | 새 세션 둘 다 유지, origin_branch_id만 NULL         |
| 질문 먼저 삭제 후 원본 세션 삭제                         | 새 세션 둘 다 유지                                  |
| 보관 질문·원본·새 세션이 남은 상태에서 계정 삭제         | 소유 세션과 질문 함께 삭제                          |
| 구간 2 Anchor 표시                                       | 노드 복제 없음, 구간 2 node_count는 0               |
| Anchor 노드 단독 삭제                                    | FK 거절 및 실패 작업 롤백                           |
| Anchor가 있는 세션 전체 삭제                             | 내부 참조와 자식 데이터 함께 삭제                   |
| 출처 FK를 일부만 NULL로 남기는 잘못된 수정               | 여전히 거절                                         |
| Message, Node, Edge, Clarification, Judge Log 및 근거 행 | 원본 삭제 시 잔존 없음                              |
| 기존 retention_rls.sql                                   | 회귀 통과                                           |

`SET CONSTRAINTS ALL IMMEDIATE`로 지연 검사를 실제 실행한 뒤 롤백한다. 롤백만 하고 성공으로 처리하면 COMMIT 시점의 오류를 놓칠 수 있다.

## 실행

```sh
npm ci --prefix tools/db-replay
node tools/db-replay/replay.mjs
```

runner는 supabase/tests/*.sql을 순서대로 실행하고 하나라도 실패하면 종료 코드 1을 반환한다. 테스트는 합성 데이터만 사용한다.

## 범위

Supabase Auth/HTTP API·동시 요청·pg_cron 실행을 포함하지 않는다. 자동 삭제 예약은 활성화하지 않았다. 이 수정의 운영 DB 적용 및 main 병합은 별도이며, 배포 전 원격에서 동일 테스트를 검증해야 한다. 전체 Supabase reset과 자동 정리 작업도 남아 있다.
