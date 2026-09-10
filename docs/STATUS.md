# STEP 1 작업 상태

기준일: 2026-09-10

## 완료한 구현

- 기존 개발 규칙 보존·보강 및 첨부 PRD / 인수인계 원본 보관
- 문서 충돌·미결 사항을 `DECISIONS.md`에 기록
- Next.js 16.3.4 / React 19.3.0 / TypeScript / npm 초기화
- SEED React 2.4.1 및 CSS 2.7.0 적용
- 한국어 최소 첫 화면·접근 가능한 입력창·모바일 대응 스타일
- OpenAI 7.13.0, Supabase JS 2.116.0 / SSR 0.12.7, Zod 4.6.1 기반
- 서버 전용 키 보호, 환경변수 지연 검증, 공개 키와 서버 키 구분
- 외부 API를 호출하지 않는 `/api/health`
- npm 잠금 파일, Prettier, ESLint, 타입 검사, 빌드 스크립트

## 검증 결과

| 확인                        | 결과                                                                 |
| --------------------------- | -------------------------------------------------------------------- |
| `npm run format:check`      | 통과                                                                 |
| `npm run validate`          | 타입 검사 → 린트 → 빌드 통과                                         |
| `npm audit`                 | 알려진 취약점 0건                                                    |
| 프로덕션 서버 `/`           | HTTP 200, 한국어 문구·textarea·접근성 레이블 확인                    |
| 프로덕션 서버 `/api/health` | HTTP 200, `{service: "nook", status: "ok", stage: "initialization"}` |
| 외부 키 없이 첫 화면        | 빌드·응답 성공                                                       |
| 원본 문서                   | 첨부 파일을 그대로 보관, 포맷터 대상 제외                            |

프로덕션 HTTP 검증은 로컬 실행 기준입니다. 브라우저 시각 QA 및 실제 Vercel 접속 검증과 구분합니다.

## 배포

Vercel에 첫 Preview 배포를 생성했습니다. 소스 기준 커밋은 `fc0d85af1640cd1654b7f14ee2e4d9210462e747`입니다.

- 배포 ID: `dpl_DtV4XW5uZ3wEie6M4QrhQunVPDjW`
- 배포 주소: https://nook-cr0l98ap2-suzie990806-3166.vercel.app
- 관리 화면: https://vercel.com/suzie990806-3166/nook/DtV4XW5uZ3wEie6M4QrhQunVPDjW
- 대상: preview
- 마지막 확인된 생성 응답: INITIALIZING
- 배포 방식: GitHub에 반영한 소스 파일을 Vercel API로 전달. GitHub 자동 배포 연결은 미검증.

현재 연결된 Vercel 계정으로 팀 `suzie990806-3166`의 배포 상태·프로젝트·빌드 로그를 조회하면 403 Forbidden이 반환됩니다.
팀 접근 권한을 포함한 인증이 필요하다는 오류입니다. 연결 플러그인 설치 완료와 이 팀의 리소스 조회 권한을 구분합니다.

직접 HTTP 요청은 첫 화면과 `/api/health` 모두 Vercel 로그인 페이지로 이동했습니다.
로그인 페이지의 HTTP 200은 Nook의 정상 응답으로 계산하지 않습니다.
인증된 배포 페이지 조회도 403으로 차단되어 원격 빌드 성공·실제 앱 접속을 아직 검증하지 못했습니다.

따라서 STEP 1 전체를 완료로 표시하지 않습니다.
팀 접근 권한 해결 후 동일 배포의 상태·로그·실제 응답부터 확인하고, 불필요한 중복 배포를 만들지 않습니다.

## 아직 구현하지 않은 것

AI 모델 호출, Safety / Judge / Reframe / Reflection, ERD / SQL / RLS, 익명 인증과 OAuth,
Thought Path, Pile, 데이터 저장, 실제 eval은 다음 단계입니다.

현재 입력은 브라우저의 입력창에만 존재하며 전송·저장하지 않습니다.
실제 API 키나 Supabase 프로젝트 연결은 설정되지 않았습니다.

## 다음 단계

1. Vercel 첫 배포와 실제 `/`, `/api/health` 접속 검증으로 STEP 1 종료
2. 문서 미결을 해결하고 ERD·테이블·RLS·SQL migration 작성
3. Core 평가셋 20개 및 별도 Safety 평가셋 준비
4. 평가셋을 기준으로 대화 엔진 구현
