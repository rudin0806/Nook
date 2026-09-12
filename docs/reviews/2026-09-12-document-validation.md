# Nook 문서·평가 파일 검증 기록

기준일: 2026-09-12. 대상 저장소: `rudin0806/Nook`, PR #2.

검증 기준은 사용자가 제공한 RULES v3 원본, JSONL 3개, EVALSET v4 패치노트, PRD v2.3 수정 요청 4건이다. 저장소 확장 규칙과 첨부 원본은 같은 버전명이지만 동일한 내용이 아니었다. 사용자 라벨을 새로 만들거나 실제 모델 평가를 실행하지 않았다.

## 1. 수신과 보존

원본 4개는 커밋 `0b698d1b49333dec493e93ecf8edeb0d4055594b`에 변경 없이 보존했다. 이후 커밋에서 확인된 패치만 반영한다.

| 전달 파일    | 저장소 위치                          | 원본 SHA-256                                                       |
| ------------ | ------------------------------------ | ------------------------------------------------------------------ |
| RULES.md     | `docs/references/RULES-v3-upload.md` | `f941105e0f88234b0d1c01385811cc774e275aac4c07836c8d73db0dd6538222` |
| judge.jsonl  | `eval/judge.jsonl`                   | `640285d111eec41a97e2d7a2aa9101a48cf75bf273396d1910a2b1d5c40eb8ed` |
| safety.jsonl | `eval/safety.jsonl`                  | `8c875aea302354f110f3ca69c1a5e9d9d75e830975790bdd6e670bf2f27d8a13` |
| start.jsonl  | `eval/start.jsonl`                   | `e93521a7b61771bc789912301d778fc99c33ddb69b3b5c5a3b591942ceafb9fd` |

`docs/references/RULES-v3-upload.md`는 수신 증빙 원본이다. 현재 실행 규칙은 `docs/RULES.md`이며 원본을 덮어써 제품 보관 정책을 되돌리지 않는다. 위 해시는 원본 커밋 기준으로, 패치를 적용한 JSONL 작업본의 해시와는 다르다.

## 2. 파일별 결론

| 파일                | 확인 결과                                                                                     | 수정 및 남은 문제                                                                                                                  |
| ------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| PRD                 | 요청한 홈 표기·20장 문구·익명 즉시 폐기·HANDOFF Message 저장 4건 반영 확인                    | 16장에 남은 포괄적 원문 미저장 문장을 STOP만으로 한정. 21장의 오래된 테스트 20개 표기를 현재 32/17/15로 수정                       |
| RULES               | CHECK 없음, hedge 보정·자발성·carryover 최대 2개·Safety 행동 분리 확인                        | 저장소의 `clarifications: []` 설명과 익명 미보관 처리 누락 수정. 첨부의 HANDOFF 상태 등은 아래 기준 확인 필요                      |
| judge.jsonl         | 32개, strict 31·boundary 1·pending 0. ID·근거·invalidate/promote와 통제쌍 검증                | 금지어 중복 2건·AI 질문 3건·참조 설명 수정. carryover 2개는 저장소 추가 필드와 불일치                                              |
| safety.jsonl        | 15개, 모두 strict. S-14/S-15의 label NONE·behavior HANDOFF 유지                               | `candidates` 누락·`depends_on` 잔여 값 수정. 현재 매핑과 category가 다른 8개는 미해결                                              |
| start.jsonl         | 17개, 모두 strict. NEEDS_INFO 4·CLEAR_AS_IS 2·REFRAME_NEEDED 11. 참조 문장과 금지어 충돌 없음 | 오래된 RULES 장 번호·ST-01 출처 설명만 수정. 입력·라벨·정답 참조 문장은 보존                                                       |
| safety_mapping.json | 저장소 파일 존재 확인                                                                         | 첨부에 별도 매핑 원본은 없었다. 현재 파일을 사용자 원본과 동일하다고 보지 않음. 직접 호환되는 7개에서 behavior 및 전화번호 값 일치 |
| ERD                 | PRD의 저장 원칙과 교차 검토                                                                   | 첫 Raw Thought가 HANDOFF일 때도 Message를 만들지 않는다는 잔여 문장 수정                                                           |

## 3. v4 패치노트 대조

### 이번에 고친 누락

- J-SHIFT-01의 `뭘 더 할 수`, J-SHIFT-04의 `보이기가 싫`은 HIGH 전용 목록에 있으면서 전체 금지 목록에도 남아 있었다. 전체 금지 목록에서만 제거했다.
- J-NOT-02 A2, J-MED-02 A2, J-CLOSE-03 A4의 AI 질문을 사용자가 지정한 새 문장으로 교체했다. J-CARRY-02 history는 이미 새 문장이어서, J-MED-02를 고친 뒤 원본 창과 정확히 일치한다.
- S-14/S-15에 `candidates: []`를 넣고 `depends_on: []`로 정리했다. 위험 라벨·category·behavior·contact 정답은 바꾸지 않았다.
- 패치 대상의 오래된 RULES 장 번호를 섹션 이름으로 바꿨다. J-PROMO-01·J-CLARI-02의 참조와 정확한 대상 ID는 이미 수정돼 있었다.

### 이미 맞았던 부분

- `input.hedge_speaker` / `input.hedge_ratio`는 32개 모두 없고, history는 fixture 메타데이터에 있다.
- J-HEDGE-01a/01b의 `input` 전체가 동일하다. 명시한 최소/확장 어미 목록 모두 01a는 5/6(true), 01b는 2/6(false). 나머지 30개는 모두 false다. 이는 fixture 통제쌍 검증이며 운영용 어미 판별기 검증이 아니다.
- J-CARRY-01a/01b는 대화 창이 같고 carryover만 다르다. history 자체를 Judge 근거로 넣지 않는다.
- J-CLARI-02는 C1만 무효화한다. J-CLOSE-03은 무효화 없음.
- J-PROMO-01은 입력의 P1만 승격한다. J-BRANCH-03은 승격 없음. EXACT 승격은 SHIFT/HIGH 전용이다.
- J-CLOSE-01은 `CLOSE/*`, J-EDGE-01은 `SHIFT/HIGH`로 서로 반대인 기대값이 유지됐다.
- boundary는 J-SHIFT-04 하나이며 통과율에 넣지 않는다. `strict`의 복수 accept는 유효하다.

## 4. 기준을 확정해야 하는 차이

| 항목                          | 첨부 원본·패치노트                                     | 현재 저장소                                        | 이번 처리                                                                                  |
| ----------------------------- | ------------------------------------------------------ | -------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| HANDOFF 대화 상태             | RULES 9장: `COMPLETED`                                 | PRD·ERD·RULES·DB: `HANDOFF_STOPPED`                | Message 저장은 양쪽 공통이므로 반영. 상태는 현재 제품 기준을 유지하되 원본과 충돌함을 기록 |
| Safety category 없음          | S-01~06: `null`                                        | 문자열 `NONE`                                      | 자동 변환하지 않음                                                                         |
| 제3자 위험                    | S-14: `THIRD_PARTY_RISK`                               | `NONE + SUICIDE_SELF_HARM`                         | 분류 단위를 고르는 문제여서 이름만 바꾸지 않음                                             |
| 전문 도움 탐색                | S-15: `MENTAL_HEALTH_CARE`                             | `GENERAL_MENTAL_HEALTH`                            | 매핑·분류 스키마 함께 확인 필요                                                            |
| carryover 사유                | 원본 스키마에 `medium_reason` 없음, 패치 리뷰 7 미반영 | 저장소 입력·출력 스키마는 해당 필드 요구           | J-CARRY-01b/02의 사유를 추측해 넣지 않음                                                   |
| S-14 연락처 문구              | `친구에게 전달할 수 있도록` 유지, 리뷰 8 대기          | 저장소 RULES는 그 표현 금지                        | 정답 원문을 보존하고 문구 검증 미완료로 분리                                               |
| hedge 면제·1턴 선언·복수 고민 | 리뷰 5·6·10은 추가 검증 전                             | 면제 범위 제한, `focus_required` 등 확장 규칙 존재 | 기존 라벨 유지. 확장안 전체가 검증됐다는 문구 수정                                         |

권장 다음 결정은 기존 제품 데이터 구조를 유지하되, Safety 분류 체계와 carryover 확장을 명시적으로 확정한 뒤 fixture·매핑·문서·DB를 한 번에 맞추는 것이다. AGENTS.md의 충돌 처리 원칙에 따라 확정 전 실제 엔진이나 DB에 새 해석을 적용하지 않는다.

추가로 원본 RULES의 `0~2는 결정론적`은 Safety Classifier가 포함된 실행도와 맞지 않는다. 현재 PRD·RULES의 `1~2는 결정론적` 설명을 유지한다. 원본 Branch의 자동 보관 표현도 이후 사용자와 확정한 `PENDING → 명시 선택한 것만 KEPT`를 대체하지 않는다.

## 5. 검증 명령과 한계

```bash
npm run eval:validate
npm run typecheck
npm run lint
npm run build
```

- 정적 검사에서 발견한 패치·fixture 오류는 수정 전 8개 → 수정 후 0개다. 같은 대사 변경으로 해결되는 history 불일치 검사 1개도 포함한 **검사 결과 수**이며 수정 행 수가 아니다.
- 계약 호환성 오류 10개는 남는다: carryover 사유 2개 + Safety category 8개. `eval:validate`는 이를 숨기지 않고 종료 코드 1을 반환한다.
- 내용 검토에서 찾은 HANDOFF 상태·문구 충돌은 자동 검사의 10개와 별개다.
- 실제 모델을 호출하지 않았으므로 판정 정확도·False Positive Shift·MEDIUM→HIGH·Safety 미탐/오탐 수치는 아직 없다. 모델 성능이나 실사용 안전성 통과로 보고하면 안 된다.
- 전화번호는 현재 파일끼리의 값만 대조했다. 공식 연락처 최신성이나 안내 문장 품질의 검증과 구분한다.
- 새 DB migration 적용, RLS 재시험, Vercel 배포는 이번 문서 검증 범위에 포함하지 않았다.

`npm run typecheck`, `npm run lint`, `npm run build`는 모두 통과했다. 실제 서버를 실행하지 않고 검증했다. 이 결과는 fixture의 미해결 계약 충돌이나 실제 모델 성능까지 통과했다는 뜻이 아니다.
