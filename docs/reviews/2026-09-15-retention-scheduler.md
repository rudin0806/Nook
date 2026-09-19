# 만료 정리 실행 경로

기존 RULES §12의 기한과 예외를 그대로 사용한다. 신규 스키마 변경은 없다.

## 구현

`GET /api/cron/retention`은 최소 32자 CRON_SECRET의 Bearer 인증, VERCEL_ENV=production, NOOK_RETENTION_CRON_ENABLED=true를 모두 확인한 뒤에만 서버 키로 purge_expired_sessions를 호출한다. 인증 검사는 고정 길이 해시의 timingSafeEqual을 사용한다. Preview는 실제 운영 DB를 공유하더라도 실행할 수 없다. 응답은 no-store이며 원문·키·사용자 식별자 없이 성공 코드와 영구 삭제 개수만 반환한다. 휴지통 이동 개수는 이 숫자에 포함되지 않는다.

실패/타임아웃/잘못된 반환값은 503 RETENTION_FAILED_OR_UNKNOWN이다. 호출 자동 재시도는 하지 않는다. RPC는 45초에 클라이언트 대기를 중단하고 함수 상한은 60초다. 클라이언트 중단이 DB 롤백을 보장하지 않으므로 결과를 확인하기 전 수동 재실행하지 않는다. DB 함수는 사용자→세션 순서의 잠금 및 재실행 가능한 만료 조건을 사용한다.

## 운영 활성화 전 체크

1. 기존 운영 DB migration과 함수 service_role 권한을 확인한다.
2. 운영 환경에 SUPABASE_SECRET_KEY와 CRON_SECRET을 설정한다. 키는 채팅이나 저장소로 전달하지 않는다.
3. 아래 예약 후보와 물리 삭제 지연을 검토한 뒤 활성화한다. 현재 vercel.json 예약 등록은 하지 않았다.
4. 운영 배포와 NOOK_RETENTION_CRON_ENABLED=true 설정 후 Vercel 실행 로그의 HTTP 상태를 확인한다. 실제 데이터 삭제를 수반하는 수동 실행은 별도 승인 대상으로 둔다.
5. 중단 시 기능 플래그 해제·재배포 또는 Vercel Cron 비활성화를 사용한다.

예약 후보는 하루 1회 UTC 00:00(한국 09:00)이다. 이는 물리 정리 주기이며 사용자 읽기/복원 기한은 기존 DB 검증에 따라 만료 즉시 제한된다. 일별 실행은 물리 삭제가 다음 실행까지 지연될 수 있다. 데이터 규모가 증가해 45초를 넘으면 활성화 전에 배치 처리 또는 DB 내부 예약으로 재설계해야 한다.

```json
{ "crons": [{ "path": "/api/cron/retention", "schedule": "0 0 * * *" }] }
```

이 예시는 활성 설정 파일이 아니다. Vercel과 pg_cron에 같은 작업을 중복 등록하지 않는다.

공식 실행/인증 문서: https://vercel.com/docs/cron-jobs/manage-cron-jobs

## 검증 범위

HTTP 실행 게이트, 인증 실패 시 DB 미호출, 정상 반환, 예외·잘못된 결과의 실패 처리 및 자동 재시도 없음은 오프라인 테스트로 검증했다. 운영 삭제 함수 실행·예약·배포는 수행하지 않았다. 보관 규칙의 SQL 회귀는 기존 독립 DB 테스트를 따른다.
