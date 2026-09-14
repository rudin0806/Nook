# 재개 체크포인트

현재 상태와 미결은 [STATUS.md](STATUS.md)가 기준이다.

PR #2에 최신 main `65f9e63`을 동기화했다. DB migration/삭제 회귀는 main 버전을 유지하고, Judge·Prompt D·실제 평가 runner는 작업 브랜치 버전을 유지한다. main 자체와 운영 DB는 이번 작업에서 변경하지 않는다.

API 키 없이 실행할 검증:

```sh
node --experimental-strip-types --test tests/*.test.mts
npm run eval -- --dry
npm run eval:judge:validate
node tools/db-replay/replay.mjs
npm run validate
```

위 검증은 통과했다: 단위 테스트 46개, 기본 Judge dry 2개, Judge fixture 32개 정적 검증, migration 5개 재현과 삭제 연쇄·만료 경계·RLS SQL 3개, typecheck/lint/build. 만료 경계 검사는 독립 빈 테스트 DB에서만 실행한다.

보관·휴지통 Route Handler는 [구현 기록](reviews/2026-09-13-retention-api.md)을 따른다. 익명 로그인과 Google/Kakao identity linking, 실제 Supabase 인증 쿠키를 사용한 HTTP 왕복 검증은 아직 하지 않았다.

`npm run eval:validate`의 Safety category 불일치 8건은 미해결로 유지한다. 자동 삭제 예약은 실행하지 않는다.

Judge 유료 평가는 `.github/workflows/judge-eval.yml`에서 repository secret `AI_API_KEY`를 사용한다. Prompt B 보수성 조정 뒤 `gpt-5.6-sol` reasoning high의 최종 32건 실행은 strict 31/31, action 31/31, API·JSON·Zod 오류 0이었다([run 34795136112](https://github.com/rudin0806/Nook/actions/runs/34795136112), [조정 기록](reviews/2026-09-14-judge-sol-tuning.md)). boundary J-SHIFT-04는 정확도에서 제외하고 REFLECT/MEDIUM 분포로 기록했다.

[Judge 런타임 어댑터](reviews/2026-09-14-judge-runtime-adapter.md)는 서버 전용 내부 모듈과 검증까지만 구현했다. 이번 작업에서 유료 평가를 다시 실행하지 않았고 공개 API Route도 만들지 않았다. 다음 구현 경계는 Safety → 사용자 종료 의사 → 구조 상한 → Judge → C/D → 원자적 저장이다. Prompt C 산출물은 아직 대기 중이다.
