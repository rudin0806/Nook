# 보관·휴지통 API 구현 기록

기준일: 2026-09-13

## 구현 범위

브라우저의 Supabase 인증 쿠키를 사용하는 Route Handler를 추가했다. 모든 요청은 `auth.getUser()`로 현재 사용자를 확인한 뒤, 기존 RLS view 또는 소유권 검사가 포함된 SECURITY DEFINER RPC를 호출한다. `SUPABASE_SECRET_KEY`는 사용하지 않는다.

| Method   | 경로                             | 동작                                                     |
| -------- | -------------------------------- | -------------------------------------------------------- |
| `GET`    | `/api/sessions?collection=active | saved                                                    | trash` | 진행 중·생각더미·휴지통 목록 |
| `POST`   | `/api/sessions/:id/retention`    | 완료된 기록 보관 여부와 보관 질문을 한 트랜잭션에서 확정 |
| `POST`   | `/api/sessions/:id/trash`        | 생각더미 기록을 7일 휴지통으로 이동                      |
| `POST`   | `/api/sessions/:id/restore`      | 만료 전 휴지통 기록을 생각더미로 복원                    |
| `GET`    | `/api/branch-questions`          | 사용자가 명시적으로 남긴 질문 목록                       |
| `DELETE` | `/api/branch-questions/:id`      | 남겨둔 질문 영구 삭제                                    |

목록은 한 번에 최대 50개를 반환하며 `limit`·`offset`을 지원한다. 응답은 원문 Message와 `user_id`를 포함하지 않는다.

`retention` 요청 본문:

```json
{
  "keepSession": true,
  "keptBranchIds": []
}
```

`finalize_session_retention` RPC가 세션 상태, 소유권, 익명 계정 여부, 질문 출처와 중복 선택을 다시 검사한다. 익명 사용자가 아무것도 남기지 않으면 결과는 `deleted`, 연결된 사용자가 기록을 남기지 않으면 `trashed`, 기록을 남기면 `saved`다.

## 오류와 보안

- 잘못된 UUID·목록 조건·JSON·8 KiB 초과 본문은 DB 호출 전에 거절한다.
- 로그인 없음은 `401`, 계정 연결 필요·이미 결정된 상태는 `409`, 소유하지 않았거나 대상 상태가 아닌 항목은 `404`로 응답한다.
- DB 내부 오류 문구는 일반 응답으로 바꾸고, 다른 사용자의 데이터 존재 여부를 공개하지 않는다.
- 목록은 security-invoker view와 RLS로 현재 사용자의 행만 읽는다.
- 변경은 기존 RPC가 `auth.uid()`와 행 상태를 검사한 경우에만 성공한다.

## 검증

- API 입력·목록 출력·공개 오류 변환 5개 테스트 추가.
- 전체 단위 테스트 34개 통과.
- 기존 `retention_rls.sql`에서 다른 사용자 조회·변경 차단, 익명 보관 차단, 본인 보관·휴지통·복원을 검증한다.
- 기존 `retention_expiry.sql`에서 만료 시각·SAVED 보호·일반 사용자 정리 함수 차단을 검증한다.

실제 Supabase 쿠키를 발급하는 익명 로그인, Google/Kakao identity linking, 배포 환경의 HTTP 왕복 검증과 화면 연결은 다음 범위다.
