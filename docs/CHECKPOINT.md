# 재개 체크포인트

현재 상태와 미결은 [STATUS.md](STATUS.md)가 기준이다.

PR #2에 최신 main `65f9e63`을 동기화했다. DB migration/삭제 회귀는 main 버전을 유지하고, Judge·Prompt D·실제 평가 runner는 작업 브랜치 버전을 유지한다. main 자체와 운영 DB는 이번 작업에서 변경하지 않는다.

API 키 없이 실행할 검증:

```sh
node --experimental-strip-types --test tests/*.test.mts
npm run eval -- --dry
node tools/db-replay/replay.mjs
npm run validate
```

위 검증은 통과했다: 단위 테스트 34개, 기본 Judge dry 2개, migration 5개 재현과 삭제 연쇄·만료 경계·RLS SQL 3개, typecheck/lint/build. 만료 경계 검사는 독립 빈 테스트 DB에서만 실행한다.

보관·휴지통 Route Handler는 [구현 기록](reviews/2026-09-13-retention-api.md)을 따른다. 다음 시작점은 익명 로그인과 Google/Kakao identity linking이며, 실제 Supabase 인증 쿠키를 사용한 HTTP 왕복 검증은 아직 하지 않았다.

`npm run eval:validate`의 Safety category 불일치 8건은 미해결로 유지한다. 유료 모델 호출·자동 삭제 예약은 실행하지 않는다.
