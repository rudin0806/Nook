# DB SQL replay

앱 의존성과 분리한 PostgreSQL SQL 재현 도구다. 저장소 루트에서:

```sh
npm ci --prefix tools/db-replay
node tools/db-replay/replay.mjs
node tools/db-replay/replay.mjs --helper
```

모든 데이터는 메모리 안에서 생성된다. 실패 시 종료 코드 1. 동일 RLS SQL은 별도 Supabase 테스트 DB에서 트랜잭션으로 실행할 수 있다.

Supabase 전체 에뮬레이터가 아니다. 최소 auth 스키마·역할을 생성하고 pgcrypto 설치만 생략한다. 범위와 원격 검증 기록은 `docs/reviews/2026-09-12-db-replay.md`를 참고한다.

`supabase/tests/*.sql`을 모두 실행한다. 삭제 연쇄 검사는 지연 제약을 강제로 확인하므로 COMMIT 시점의 오류도 잡는다. 수정 전 재현 결과와 검증 범위는 `docs/reviews/2026-09-13-deletion-chain.md`에 기록했다.
