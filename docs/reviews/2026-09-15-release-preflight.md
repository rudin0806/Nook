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

## 후속: 사용자 승인 후 운영 적용 완료

사용자가 위 2건의 운영 DB 적용을 승인하여 적용했다. 첫 migration은 원격 `20260915015038`, 두 번째는 `20260915015057`로 기록됐다. 운영 migration은 8건에서 10건으로 늘었다. 이전 거절은 이번 명시적 승인 이전 기록이다.

- 운영 카탈로그 점검 11/11 통과.
- 인증 정보 없는 authenticated 역할의 list_recoverable_sessions/read_restart_source/settle_own_retention 호출은 모두 AUTHENTICATION_REQUIRED로 거절됐다. 검사는 ROLLBACK으로 끝냈다.
- 보안 advisor WARN 12개, INFO 4개. 새 WARN 3개는 인증 사용자에게 제공하는 소유자 전용 RPC이며, 새 INFO 2개는 클라이언트 접근을 차단한 서버 전용 테이블이다. 권한 점검은 통과했으며 경고 전체가 제거된 것으로 보고하지 않는다.
- Cron 등록·정리 함수 실행·Vercel 배포·기능 공개·PR 병합은 실행하지 않았다. 다음 단계는 배포 환경 설정과 검증용 배포 및 실제 사용자 흐름 검증이다.


## 후속: Preview 배포 및 연결 점검

2026-09-15, PR 소스 기준 `9a42fc5c550cf7bd251bd57aba23f1a94566bba7`에서 파일 업로드 방식으로 Preview를 배포했다. Vercel Git 연결/metadata가 SHA를 증명하는 배포는 아니다.

- Preview: https://nook-ivnpjoaml-suzie990806-3166.vercel.app
- 배포 ID: `dpl_AKygBMeRmpCHZgeqqDuALDntMUFY`, READY. 운영 배포는 변경하지 않았다.
- 첫 배포는 업로드 묶음에 `eval/safety_mapping.json`이 누락돼 빌드 실패했다. 해당 런타임 데이터를 포함한 114개 파일로 재배포하여 빌드가 성공했다. 다음 업로드에서도 src/public뿐 아니라 이 파일을 반드시 포함해야 한다.
- 커넥터 GET `/api/recovery`: 503 `SERVICE_NOT_CONFIGURED`. Preview의 Supabase 클라이언트 초기화가 실패했다. 우선 Preview 범위의 `NEXT_PUBLIC_SUPABASE_URL` 및 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 설정을 확인하고 재배포해야 한다. 이 응답만으로 운영 DB 장애나 누락된 변수 하나를 확정하지 않는다.
- 다른 GET 점검은 Vercel 보호 계층의 302 인증 리다이렉트로 종료됐다. 일부 최초 병렬 요청은 공유 URL 생성 충돌(409)이 있었고 순차 재시도에서도 인증 리다이렉트였다. 앱의 정상 200/400/401 확인으로 계산하지 않는다.
- 사용 가능한 Vercel 연결 도구에는 환경변수 조회/수정 기능이 없고 로컬 Vercel 인증도 없어 환경 설정 수정은 수행하지 못했다. 보호 설정을 임의로 해제하지 않았다.
- 다음 실행 순서: Preview 환경변수 및 canonical origin/OAuth callback 구성 확인 → 재배포 → 인증된 브라우저로 Google 로그인/대화/복귀/보관/복원/연결 재시작 검증 → 자동 정리 예약과 운영 배포 별도 진행.
- 전체 완성도 추정: 핵심 기능 구현 약 85%, 출시 준비 약 65~70%. 측정된 진척률이 아닌 남은 작업과 검증 위험을 반영한 판단이다. UX/UI 재정비, 카카오 로그인, 브랜딩 공개, AI CLOSE 기준 1건이 남아 있으며 PR 병합 보류를 유지한다.
