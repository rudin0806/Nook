# 운영 적용 사전 점검 — 2026-09-15

기준 코드: PR #2 `4191de9457373423b4b3e48a7d4a184a7dd65de7`. 이번에는 운영 읽기 점검과 재사용 가능한 확인 도구를 추가했다.

## 확인한 운영 상태

- Supabase NOOK: ACTIVE_HEALTHY, PostgreSQL 17. 운영 세션 0건(점검 시각 기준).
- 적용 이력 8건. 첫 입력·승인까지 적용돼 있고 `conversation_runtime`, `session_recovery_and_restart`는 미적용이다. `pg_cron`도 설치되지 않았다.
- Vercel nook: 최신 운영 배포 `dpl_EyQeAng4BeWiafqoAsW2w5yUmSAN`, READY. 프로젝트의 Git 연결은 null이며 배포 metadata에서 기준 Git SHA를 확인할 수 없었다. PR 갱신이 곧 운영 배포라는 의미는 아니다.
- Vercel 커넥터로 `/api/health` 200을 확인했다. 이 경로는 살아 있는지만 알려주며 DB·모델·새 기능 준비 완료를 뜻하지 않는다.
- 보안 advisor: 기존 authenticated SECURITY DEFINER 경고 9건 유지. 서버 전용 요청 제한 테이블 2개의 RLS/no-policy INFO는 클라이언트 접근을 열라는 뜻이 아니다.

## 추가한 확인 도구

- `supabase/snippets/verify_release_readiness.sql`: 읽기 전용 카탈로그 검사 11개. 새 테이블 4개의 RLS/접근 권한, RPC 7개의 호출 권한·존재 여부를 확인한다. 앱 함수나 정리 함수를 실행하지 않는다. 실제 소유권 동작 검사는 기존 SQL 회귀가 담당한다.
- 운영 실행 결과: 11개가 미충족. 새 migration 미적용을 확인한 결과이며, 적용돼 있는 기존 서비스가 11곳 고장났다는 의미가 아니다.
- 독립 DB에서 migration 적용 후 같은 검사 11개 모두 통과. replay 도구에 연결해 회귀 시 함께 검사한다.
- `npm run release:check -- --url https://배포주소`: 공개 GET만 전송하며 쿠키·토큰·사용자 원문을 보내지 않는다. health, 새 경로의 UUID 거절, 복귀 목록의 미인증 차단을 확인한다. HTML fallback, 503, 통신 실패를 성공으로 처리하지 않는다. OAuth/AI/DB 통합 테스트를 대체하지 않는다.
- 이 작업 환경의 직접 외부 HTTP 요청은 응답을 확보하지 못했다. 이는 운영 장애 판정이 아니며, Vercel 커넥터 점검 결과와 구분한다.

## 개발 검증

전체 오프라인 테스트 140개, 타입·린트·프로덕션 빌드 통과. 독립 SQL 회귀 7개와 새 읽기 전용 점검 11개 통과. 실제 운영 인증·모델 왕복은 미실행이다.

## 적용이 멈춘 이유와 승인할 작업

자동 승인 검토가 `conversation_runtime` 운영 migration 적용을 거절했다. 사용자 요청은 개발 계속 진행이며, 운영 DB의 지속적인 스키마·RPC·RLS·권한 변경까지 명시적으로 승인한 것은 아니라는 사유다. 우회 실행하지 않았으며 DB 변경은 실행되지 않았다.

승인 대상은 기존 검증 코드의 다음 2건이다.

1. `20260914145756_conversation_runtime.sql`: 첫 승인 이후 대화 상태, 사용자 승인과 안전한 대화 결과의 원자적 기록.
2. `20260915011312_session_recovery_and_restart.sql`: ACTIVE 직접 보관, 여러 대화 복귀, 계정 대화 24시간 후 휴지통 전환, 연결된 새 세션과 독립 보관.

승인 후 위 순서로 적용하고 함수/테이블 권한·RLS와 원격 이력을 재확인한다. migration 설치 자체는 정리 함수를 실행하지 않는다. Cron 예약 활성화와 새 Vercel 배포는 이 두 migration과 다른 운영 단계다. 운영 데이터가 새로 생기면 적용 직전에 다시 현황을 점검한다.

## 계속 남은 항목

운영 DB 적용 승인, 자동 정리 예약·배포 설정, 실제 Google 로그인→입력→승인→대화→이탈 복귀→보관/복원→재시작 검증. AI CLOSE 판정 기준 1건과 UX/UI·카카오 로그인·브랜딩 공개는 기존 미결로 유지한다. PR 병합 보류도 유지한다.
