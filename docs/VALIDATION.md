# 검증

Nook은 코드 계약, 데이터베이스 규칙, AI 출력 계약, 운영 화면을 서로 다른 층에서
검증한다. 한 층의 통과를 다른 층의 성공으로 과장하지 않는다.

## 로컬·CI 검사

```bash
node --experimental-strip-types --test tests/*.test.mts
npm run eval:validate
npm run eval:judge:validate
npm run validate
```

| 검사               |  현재 기준 | 확인 범위                            |
| ------------------ | ---------: | ------------------------------------ |
| 단위·계약 테스트   |    206/206 | 엔진, API, 인증, 보관, UI 계약       |
| PGlite DB replay   | 28+13 PASS | RLS, 소유권, 삭제, 동시성            |
| Judge fixture      |       39건 | 라벨, confidence, 근거, 질문 이동    |
| `npm run validate` |       PASS | TypeScript, ESLint, production build |

`offline-validation.yml`은 `main` 변경 시 무료 검사를 수행한다. 실제 OpenAI 호출이 있는
평가 workflow는 비용 통제를 위해 수동 실행만 허용한다.

## AI 평가

운영 Judge는 `gpt-5.6-sol`과 reasoning `low`를 사용한다. 같은 39개 fixture의 단일
실행 비교에서 다음 결과를 얻었다.

| 설정             |  통과 | 놓친 질문 이동 | Judge 평균 지연 |
| ---------------- | ----: | -------------: | --------------: |
| `sol / medium`   | 35/39 |              0 |         9,554ms |
| `sol / low`      | 36/39 |              0 |         4,060ms |
| `terra / medium` | 34/39 |              3 |         3,919ms |

이 수치는 작은 고정 fixture의 단일 표본이다. 따라서 절대 정확도가 아니라 회귀 탐지와
설정 간 상대 비교에 사용한다. 생성 단계인 Reflection은 분류 fixture가 없어 실제 대화
재연과 문장 검사기를 함께 사용한다.

## 데이터베이스 검증

`tools/db-replay`는 독립 PGlite 인스턴스에 migration 28개를 순서대로 적용하고 SQL
suite 13개와 읽기 전용 readiness 검사 11개를 실행한다. 주요 검사는 다음과 같다.

- 60권 책장에서 앞·뒤·중간 이동과 자리 연속성
- 다른 탭 변경 시 fingerprint 충돌
- 사용자 간 소유권 차단과 익명 사용자 경계
- 보관, 복원, 휴지통 이동, 만료 삭제
- 동의 기록과 서버 전용 변경 권한

```bash
npm ci --prefix tools/db-replay
node tools/db-replay/replay.mjs
```

## 화면·운영 검증

- 데스크톱 1280·1440·1600px, 모바일 390px
- 라이트·다크 테마
- 키보드, 좌우 스와이프, `prefers-reduced-motion`
- 가로 오버플로와 0×0 아이콘 검사
- production URL HTTP 200
- Vercel 배포 직후 runtime error 검사

OAuth 제공자 콘솔 설정, 실기기 로그인, 실제 만료 데이터의 Cron 실행은 외부 운영 상태가
필요하므로 [STATUS](STATUS.md)의 제출 후 확인 항목으로 분리한다.
