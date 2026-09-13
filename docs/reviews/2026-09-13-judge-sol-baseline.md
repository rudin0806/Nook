# Judge Sol 32건 기준선

기준일 2026-09-13. [GitHub Actions run 34758414672](https://github.com/rudin0806/Nook/actions/runs/34758414672)에서 `gpt-5.6-sol`로 Judge fixture 32건을 순차 실행했다. 이 문서는 Core Judge만 다루며 Start, Safety, Prompt C/D의 품질 결과가 아니다.

## 실행 계약

- 입력: fixture의 `input`과 코드로 계산한 `hedge_speaker`만 전송. gold, rationale, 전체 history는 제외.
- Responses API, `store: false`, 재시도 0, API 오류 시 이후 호출 중단.
- 호출당 최대 출력 1,024토큰. 모델의 reasoning effort는 명시하지 않아 Sol 기본값을 사용했다.
- 32건 중 strict 31건, boundary 1건(`J-SHIFT-04`). boundary는 통과율과 오류 합계에서 제외했다.
- 실행은 API 오류·미완료·JSON/스키마 오류 없이 32/32 완료했다.

## 결과

| 지표                    |          결과 |
| ----------------------- | ------------: |
| strict 통과             | 20/31 (64.5%) |
| action 일치             | 20/31 (64.5%) |
| False Positive Shift    |             0 |
| MEDIUM → HIGH           |             0 |
| 금지어 위반             |             0 |
| 놓친 strict SHIFT       |             4 |
| MEDIUM → LOW            |             6 |
| Branch 누락/판정 불일치 |             1 |
| API·미완료·스키마 오류  |             0 |

모델 출력 분포는 `REFLECT/LOW` 22, `REFLECT/MEDIUM` 4, `SHIFT/HIGH` 3, `CLOSE` 3이다. 과잉 SHIFT보다 **필요한 이동과 MEDIUM 증거를 지나치게 낮게 판정하는 보수성**이 현재 핵심 문제다.

## 실패 묶음

| 묶음             | fixture              | 기대                 | 실제                         | 핵심 오류                        |
| ---------------- | -------------------- | -------------------- | ---------------------------- | -------------------------------- |
| 명시 SHIFT       | J-SHIFT-01·02·03     | SHIFT/HIGH           | REFLECT/LOW                  | SHIFT와 근거 누락                |
| hedge 보정 SHIFT | J-HEDGE-01a          | SHIFT/HIGH           | REFLECT/LOW                  | `hedge_speaker` 효과 미반영      |
| MEDIUM           | J-MED-01·02·03·04·05 | REFLECT/MEDIUM       | REFLECT/LOW                  | 근거와 `medium_reason` 단계 누락 |
| hedge 대조군     | J-HEDGE-01b          | REFLECT/MEDIUM       | REFLECT/LOW                  | ALL_HEDGED를 LOW로 하향          |
| Branch           | J-BRANCH-01          | REFLECT/LOW + branch | REFLECT/MEDIUM + branch 없음 | action과 branch 모두 불일치      |

`J-SHIFT-04`는 boundary이며 `REFLECT/MEDIUM`이 허용 결과 중 하나라 통과율에는 영향을 주지 않는다. 분포상 실제 결과도 `REFLECT/MEDIUM`이었다.

## 토큰과 비용

- 입력 95,434토큰
- 출력 10,405토큰
- 공개된 uncached 단가($4/M input, $20/M output)를 전부 적용한 상한 추정: **$0.590**
- 앞선 2건 관문 실행까지 합친 성공 호출 상한 추정: **$0.627**

실제 청구액은 cached input 적용 여부에 따라 더 낮을 수 있다. 앞선 HTTP 400 진단 호출은 보고된 사용량이 0이었다.

## 다음 튜닝 원칙

1. 전체 SHIFT 문턱을 일괄 낮추지 않는다. 현재 False Positive Shift 0이라는 보호 성능을 회귀 기준으로 유지한다.
2. 먼저 실패 11건만 대상으로 HIGH의 반복·명시 증거, MEDIUM 세 사유, hedge 면제 효과, action과 독립적인 branch 추출을 프롬프트에서 더 분명히 한다.
3. 실패 subset과 핵심 대조쌍을 재실행해 개선을 확인한 뒤 32건 전체 회귀를 다시 실행한다.
4. 모델 출력 원문을 저장하지 않는 현재 보고 계약을 유지한다.
