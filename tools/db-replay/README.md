# DB SQL replay

앱 의존성과 분리한 PostgreSQL SQL 재현 도구다. 저장소 루트에서:

```sh
npm ci --prefix tools/db-replay
node tools/db-replay/replay.mjs
node tools/db-replay/replay.mjs --helper
```

모든 데이터는 메모리 안에서 생성된다. 실패 시 종료 코드 1. 동일 RLS SQL은 별도 Supabase 테스트 DB에서 트랜잭션으로 실행할 수 있다.

Supabase 전체 에뮬레이터가 아니다. 최소 auth 스키마·역할을 생성하고 pgcrypto 설치만 생략한다. 전체 검증 범위는 `docs/VALIDATION.md`를 참고한다.

`supabase/tests/*.sql`을 모두 실행한다. 삭제 연쇄 검사는 지연 제약을 강제로 확인하므로 COMMIT 시점의 오류도 잡는다.

`retention_expiry.sql`은 임시 기록·휴지통의 만료 경계, 보관 기록 보호, 실행 권한 및 반복 실행을 검사한다. 전체 만료 정리 함수를 호출하므로 독립된 빈 테스트 DB에서만 실행한다. 운영 DB에서 실행하거나 예약하지 않는다.
