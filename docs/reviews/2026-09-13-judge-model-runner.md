# Judge 모델 평가 실행

`npm run eval`은 OpenAI Responses API와 기존 Judge Zod 검증·채점기를 연결한다. 실제 모델 호출 결과와 테스트 대역의 결과를 구분한다.

## 설정

실행 환경의 `.env.local`에 `OPENAI_API_KEY`와 `NOOK_EVAL_MODEL`을 설정한다. 키는 채팅이나 GitHub에 넣지 않는다. Vercel에만 등록된 환경변수는 로컬 명령에 자동 전달되지 않는다. 모델은 기본값 없이 명시하며 계정의 가용성과 가격을 확인한다.

GitHub Actions에서는 repository secret `AI_API_KEY`를 workflow 내부의 `OPENAI_API_KEY`로만 연결한다. `.github/workflows/judge-eval.yml`은 수동 실행 또는 작업 브랜치의 `.github/eval-trigger.json` 변경으로만 실행한다. 기본 실행은 `gpt-5.6-sol`과 J-CLOSE-01/J-EDGE-01 두 사례이며, workflow 권한은 저장소 읽기로 제한한다.

```sh
npm run eval -- --dry
npm run eval -- --model YOUR_MODEL_ID
npm run eval -- --model YOUR_MODEL_ID --ids J-MED-01,J-HEDGE-01a,J-HEDGE-01b --max-cases 3
```

기본은 J-CLOSE-01/J-EDGE-01 두 사례, 최대 2호출이다. 명시적 ids/max-cases로 늘린다(최대 32). 출력은 호출당 1024토큰, max-output-tokens 범위 256~4096. 요청 timeout 30초, 재시도 0, 순차 실행이며 API 오류 시 이후 호출을 중단한다. 이는 달러 기준 비용 상한이 아니다. 추론 모델은 출력 상한에 추론 토큰도 포함될 수 있어 미완료 응답을 확인해야 한다.

## 데이터와 결과

- 모델에는 fixture.input과 계산된 hedge_speaker만 전달한다. 전체 history·정답·rationale는 제외한다.
- store:false. 공급자의 별도 보존 정책이 없다는 뜻은 아니다.
- JSON mode 다음 Zod로 실제 스키마를 검사한다. JSON mode만으로 스키마 준수를 보장하지 않는다. CLOSE confidence 생략 계약을 유지한다.
- 미완료·거절·잘못된 JSON·스키마 오류를 실패로 기록한다. 원시 SDK 오류나 모델 원문은 보고서에 남기지 않는다.
- eval/reports/에 prompt/fixture 해시, 모델명, 토큰 사용량, 판정 및 오류 종류를 저장한다. git에서는 제외한다.
- boundary는 strict 분모와 오류 집계에서 제외한다. 판정 일치와 전체 결정론 검사 통과를 나눈다. MEDIUM→HIGH는 False Positive Shift에도 집계한다.
- 의미 검토, Start/Safety/D 평가, 실제 서비스의 대화 호출은 범위 밖이다.

## 확인된 결과

주입형 transport 테스트 7개 통과: 입력 정보 분리, 호출 상한, fixture 오류 사전 중단, 오류 중복 집계, 잘못된 응답, API 실패 중단, boundary 제외. 실제 모델의 성공 응답을 측정한 결과가 아니다.

기본 두 fixture dry-run과 타입·린트·빌드 통과. 로컬 환경에는 키를 저장하지 않는다. GitHub Actions secret을 이용한 첫 실제 모델 평가는 별도 실행 결과로 기록한다.

공식 API 참고: https://developers.openai.com/api/reference/resources/responses/methods/create
