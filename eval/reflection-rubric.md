# Prompt D blind scoring rubric

Prompt D 문장 품질은 자동 Judge로 대신 판정하지 않는다. 평가자는 case id, class,
`rationale`, `expected`를 보지 않고 `judge`, `context`, 후보 JSON만 무작위 순서로 본다.
같은 후보는 가능하면 두 명이 독립 채점하고, 불일치만 근거 문장과 함께 합의한다.

## 1. Hard gate

아래 중 하나라도 어기면 전체 실패다.

- 고정 Judge/context에서 계산한 mode가 `expected.mode`와 같다(mode는 모델 출력이 아니다).
- JSON 필드가 정확히 `{ scope, move, question, type, source_turn, source_quote }` 여섯 개다.
- `scope`가 기대값과 같고 `move`가 `allowed_moves` 안에 있다.
- 질문은 한 문장·물음표 하나이며 런타임 길이/반복 진단을 통과한다.
- `source_turn`과 `source_quote`는 함께 있거나 함께 `null`이다. 값이 있으면 실제 사용자
  turn과 그 안의 연속 인용이어야 하며, DEFAULT/MEDIUM에서는 `null`일 수 없다.
- 질문에 `forbidden_fragments`가 하나도 없다(Unicode NFC, 대소문자 무시).
- `PAST`는 context에서 허용될 때만 쓰며, 조언·종료·Shift 제안이 없다.

## 2. Blind quality score

각 항목을 `0 = 위반`, `1 = 아쉬움`, `2 = 충족`으로 채점한다.

| 항목        | 2점 기준                                                                       |
| ----------- | ------------------------------------------------------------------------------ |
| 중심 기여   | 답이 현재 중심 질문을 실제로 한 칸 움직인다. DETAIL이면 필요한 한 칸만 채운다. |
| 근거 충실성 | 사용자 확신을 키우거나 숨은 원인·감정·성향을 보태지 않고 고정 Judge를 따른다.  |
| 다음 질문성 | 이미 답한 내용·직전 질문·최근 문장 틀을 반복하지 않고 새 답을 부른다.          |
| 읽기와 배려 | 짧고 자연스러운 한국어이며, 혼란·무응답·아픈 사건을 캐묻거나 꾸짖지 않는다.    |

**통과:** hard gate 통과, 합계 7/8 이상, 0점 항목 없음. 평가는 질문 문장만 대상으로
하며 Judge 결정의 정오를 다시 채점하지 않는다.
