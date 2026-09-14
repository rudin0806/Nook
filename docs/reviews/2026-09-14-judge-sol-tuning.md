# Judge Sol 보수성 조정 기록

기준일 2026-09-14. Sol 32건 기준선의 실패 11건을 고치되 False Positive Shift 0건을 보호하기 위한 Prompt B 조정 기록이다. 실제 모델 출력 원문은 저장하지 않고 구조화 판정·오류 종류·토큰만 기록한다.

## 시도 1 — MEDIUM 최저선 문구 추가

- 커밋: [`dc24a93`](https://github.com/rudin0806/Nook/commit/dc24a9392a8d75c185b8fc9912d87e0431d05eb7)
- 실행: [GitHub Actions 34791741066](https://github.com/rudin0806/Nook/actions/runs/34791741066)
- 모델: `gpt-5.6-sol`, reasoning effort 미지정(모델 기본값)
- 범위: 기존 실패 11건 + `J-CLOSE-01` / `J-EDGE-01` 보호쌍
- 전송: 13건 전부 완료. API·JSON·Zod schema 오류 없음
- 토큰: 입력 46,704 / 출력 5,176
- 공개 uncached 단가 기준 상한: 약 $0.290

| 결과                | 건수·fixture                                       |
| ------------------- | -------------------------------------------------- |
| 전체 통과           | 2/13                                               |
| 통과                | `J-MED-03`, `J-CLOSE-01`                           |
| 놓친 SHIFT          | 5 — `J-SHIFT-01·02·03`, `J-HEDGE-01a`, `J-EDGE-01` |
| MEDIUM을 LOW로 판정 | 5 — `J-MED-01·02·04·05`, `J-HEDGE-01b`             |
| Branch 실패         | `J-BRANCH-01`; `REFLECT/MEDIUM`, branch 없음       |

### 결론

채택하지 않는다. "최소 MEDIUM" 문구만 추가해도 모델이 새 방향 후보 자체를 Q1의 세부조건으로 해석하면 LOW가 유지됐다. 기존 기준선에서 통과했던 `J-EDGE-01`까지 LOW로 회귀했다.

다음 시도에서는 유료 호출 전에 아래를 프롬프트 구조에서 수정한다.

1. 보수 정책을 `SHIFT 승격 제한`으로 한정하고 MEDIUM·Branch 증거 삭제와 분리한다.
2. confidence를 모델의 주관적 확률이 아니라 발화 출처·턴 수의 규칙 버킷으로 명시한다.
3. Q1의 세부조건을 금액·횟수·일정·스펙 같은 실행 조건으로 좁히고, 새 동기·기준과 구분한다.
4. 새 기준 후보는 MEDIUM, 해결 후 원래 질문으로 돌아오는 별도 결정은 Branch라는 우선순위를 명시한다.

두 번째 시도는 대표 경계 10건만 먼저 실행하고, 관문을 통과하기 전에는 32건 전체를 재실행하지 않는다.

## 시도 2 — 범위·confidence·Branch 우선순위 분리

- 커밋: [`97088ba`](https://github.com/rudin0806/Nook/commit/97088ba139f16aab8c9f55dc0626fb6ef9df2023)
- 실행: [GitHub Actions 34792303185](https://github.com/rudin0806/Nook/actions/runs/34792303185)
- 모델: `gpt-5.6-sol`, reasoning effort 미지정(모델 기본값)
- 범위: 실패 대표·경계 보호 10건
- 전송: 10건 전부 완료. API·JSON·Zod schema 오류 없음
- 토큰: 입력 40,186 / 출력 3,847
- 공개 uncached 단가 기준 상한: 약 $0.238

| 결과                | 건수·fixture                                         |
| ------------------- | ---------------------------------------------------- |
| 전체 통과           | 6/10                                                 |
| action 일치         | 7/10                                                 |
| 놓친 SHIFT          | 2 — `J-SHIFT-01`, `J-HEDGE-01a`                      |
| MEDIUM을 LOW로 판정 | 1 — `J-MED-01`                                       |
| MEDIUM 사유 불일치  | 1 — `J-HEDGE-01b`                                    |
| 보호 성공           | `J-NOT-01`, `J-BRANCH-01`, `J-CLOSE-01`, `J-EDGE-01` |

### 결론

아직 채택 관문은 통과하지 못했다. 다만 Branch와 CLOSE/1턴 자기 선언 보호쌍은 모두 회복했다.
남은 네 실패는 직접 답 뒤에 사용자가 덧붙인 결론을 AI 질문 범위에 흡수하거나, 표면 표현이 다른
두 자발 발화를 같은 방향으로 묶지 못한 경우다. 다음 시도에서는 이 두 판정 단계만 보강하고
실패 4건과 보호 4건을 재검증한다.

## 시도 3 — 답변 절 분리와 같은 방향 묶기

- 커밋: [`34e00f3`](https://github.com/rudin0806/Nook/commit/34e00f338c9db83329d24e9bf264cb6e0f633ca5)
- 실행: [GitHub Actions 34792709607](https://github.com/rudin0806/Nook/actions/runs/34792709607)
- 모델: `gpt-5.6-sol`, reasoning effort 미지정(모델 기본값)
- 범위: 직전 실패 4건 + False Positive/Branch/CLOSE/1턴 선언 보호 4건
- 결과: **8/8 통과**, action 8/8, 오류 0
- 토큰: 입력 36,597 / 출력 2,863
- 공개 uncached 단가 기준 상한: 약 $0.204

직접 답과 사용자가 덧붙인 결론을 절 단위로 나누고, 표면 단어가 달라도 같은 새 질문에 답하는
발화를 같은 방향으로 묶도록 명시한 것이 효과가 있었다. `J-HEDGE-01a/01b`는 동일한 현재 창에서
각각 `SHIFT/HIGH`와 `REFLECT/MEDIUM + ALL_HEDGED`로 갈렸고, 네 보호 케이스도 회귀하지 않았다.
이 프롬프트로 Judge 32건 전체 회귀를 실행한다.

## 시도 4 — Judge 32건 전체 회귀

- 커밋: [`6f74461`](https://github.com/rudin0806/Nook/commit/6f7446186ec3585d365befe7f474c5e2c096255e)
- 실행: [GitHub Actions 34792907882](https://github.com/rudin0806/Nook/actions/runs/34792907882)
- 모델: `gpt-5.6-sol`, reasoning effort 미지정(모델 기본값)
- 결과: strict **26/31(83.9%)**, action 28/31, boundary 1건 별도
- 토큰: 입력 146,122 / 출력 12,147
- 공개 uncached 단가 기준 상한: 약 $0.827
- API·JSON·Zod schema 오류: 0

| 실패                 | fixture      |
| -------------------- | ------------ |
| missed SHIFT         | `J-SHIFT-02` |
| Branch 과잉 생성     | `J-NOT-02`   |
| AI 해석어 저장       | `J-AI-01`    |
| False Positive Shift | `J-CARRY-02` |
| CLOSE 누락           | `J-CLOSE-03` |

`J-SHIFT-04`는 boundary라 통과율에서 제외했고 `REFLECT/MEDIUM` 분포만 기록한다. False Positive가
1건 남았으므로 최종 채택하지 않는다. 다음 관문에서는 위 다섯 케이스와 각각의 회귀 보호 케이스만 실행한다.

## 시도 5 — carryover·Branch·CLOSE 경계 관문

- 커밋: [`a9832dd`](https://github.com/rudin0806/Nook/commit/a9832dd1002ab56153d2dfa70af7b3655f9eeec2)
- 실행: [GitHub Actions 34793377430](https://github.com/rudin0806/Nook/actions/runs/34793377430)
- 모델: `gpt-5.6-sol`, reasoning effort 미지정(모델 기본값)
- 결과: **9/10 통과**, action 9/10
- 토큰: 입력 51,338 / 출력 3,947
- 공개 uncached 단가 기준 상한: 약 $0.284

`J-SHIFT-02`, `J-NOT-02`, `J-AI-01`, `J-CARRY-02`와 보호 케이스는 모두 통과했다.
남은 실패는 `J-CLOSE-03`의 CLOSE 누락 한 건이다. 확인 결과 confidence 절의 "MEDIUM과 LOW는
모두 REFLECT"라는 문장이 뒤의 CLOSE 절과 충돌했다. action 순서를 SHIFT → CLOSE → REFLECT로
고쳐 충돌을 제거하고 CLOSE 및 과잉 CLOSE 보호군만 다시 검증한다.

## 시도 6 — action 판정 순서 충돌 제거

- 커밋: [`813ce5a`](https://github.com/rudin0806/Nook/commit/813ce5a3b554efaac34a77c9742d35cb9f968872)
- 실행: [GitHub Actions 34793656557](https://github.com/rudin0806/Nook/actions/runs/34793656557)
- 모델: `gpt-5.6-sol`, reasoning effort 미지정(모델 기본값)
- 결과: **8/10 통과**, action 9/10
- 토큰: 입력 52,599 / 출력 3,235
- 공개 uncached 단가 기준 상한: 약 $0.275

`J-CLOSE-03`은 여전히 REFLECT/LOW였고, 직전 시도에서 통과한 `J-CARRY-02`가 이번에는 action은
맞지만 금지 Branch를 하나 만들었다. 동일 규칙의 결과가 실행 사이에 바뀌었으므로 프롬프트 문구를
더 늘리지 않는다. 같은 프롬프트·같은 10건을 `gpt-5.6-sol`의 reasoning high로 실행해 판정 안정성과
추가 비용을 비교한다. high에서는 reasoning token을 포함한 출력 상한을 2,048로 올린다.
