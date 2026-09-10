응. 이번엔 **“코덱스로 넘겨도 맥락이 끊기지 않는 인수인계 문서”** 수준으로 정리할게.
아래는 **지금까지 대화에서 확정한 결정 + 최신 PRD v2 + 기술 스택 + 개발 규칙 + 일정 + 예외/세이프티 + 현재 진행상태**를 합친 최종본이야.

---

# Nook — Codex/Work 개발 인수인계

## 0. 현재 상태

프로젝트명은 **Nook(눅)**. 의미는 구석진 아늑한 자리, 뭔가를 잠시 넣어두는 공간이다. 태그라인은 **“답을 주는 대신, 내가 어떤 질문을 지나왔는지.”** 내부적으로는 AI 저널·상담·마인드맵이 아니라 **Personal Thinking Tool**로 정의한다.

현재까지 완료된 것:

| 항목상태             |                  |
| ---------------- | ---------------- |
| 제품 방향            | 확정               |
| 서비스명 Nook        | 확정               |
| PRD v2           | 확정               |
| Safety Flow      | 1차 확정            |
| 단순 질문 처리         | 확정               |
| 기술 스택            | 확정               |
| 별도 백엔드 여부        | **만들지 않기로 확정**   |
| GitHub 저장소       | 사용자가 생성 완료       |
| `.gitignore`     | Node 기준으로 생성     |
| 패키지 매니저          | **npm으로 통일**     |
| SEED Design 사용   | 확정               |
| 개발 규칙            | AGENTS.md에 작성 예정 |
| ERD              | 다음 작업            |
| Supabase 실제 테이블  | 아직               |
| 테스트셋 20개         | Claude와 작업 예정    |
| Next.js 프로젝트 초기화 | 아직               |
| Vercel 첫 배포      | 아직               |

현재 역할 분담:

> **1. 프로젝트 초기화 + 첫 배포 → ChatGPT/Work와 진행**
> **2. ERD + Supabase 테이블 → ChatGPT/Work와 진행**
> **3. Core 테스트셋 20개 → Claude와 진행**

---

# 1. 제품이 해결하는 문제

문제는 “답을 찾지 못한다”가 아니다.

> **생각이 진행되면서 내가 실제로 무엇을 고민하고 있는지, 질문의 중심을 잃어버리는 문제.**

사용자는 처음부터 생각을 논리적으로 정리해서 입력할 필요가 없다.

첫 화면 카피:

> **머릿속에 걸리는 게 있나요?**
> **정리하지 말고 생각나는 대로 적어주세요.**

첫 화면에서 “답을 주지 않습니다”라고 선언하지 않는다. 사용자는 “내 질문이 흐리다”고 자각하고 들어오는 게 아니라 “이거 어떡하지” 상태로 들어온다. 최종적으로 사용자가 스스로 **“아, 내가 사실 이걸 고민하고 있었구나”**라고 느끼는 것이 목적이다.

---

# 2. 검증할 핵심 가설

딱 하나다.

> **사용자는 AI가 답을 주지 않아도, 자신의 질문이 더 선명해지고 그 변화가 눈에 보인다면 충분한 효용을 느끼는가?**

첫 사용의 성공과 사업 성공은 구분한다.

첫 사용:

> 질문이 선명해졌는가?

두 번째 이후:

> 다음에 머릿속이 복잡해졌을 때 ChatGPT 대신 Nook을 다시 열었는가?

---

# 3. ChatGPT와의 차별점

절대:

> “ChatGPT에서는 할 수 없다.”

라고 주장하지 않는다.

기술적으로 가능하기 때문이다.

현재 포지셔닝:

> **범용 채팅에서는 사용자가 별도로 요청해야 하는 ‘현재 질문 고정 · 질문 이동 구조화 · 경로 저장’이 Nook에서는 기본 경험이자 기본 데이터 구조다.**

첫 세션에서의 이유:

| 일반 채팅Nook       |                  |
| --------------- | ---------------- |
| 사용자가 대화의 목적을 관리 | 정리되지 않은 말로 시작 가능 |
| 현재 질문을 사용자가 기억  | 현재 질문을 항상 화면에 표시 |
| 대화 로그가 남음       | 질문이 이동한 경로가 남음   |

두 번째 사용부터는 **쌓인 질문의 역사**가 경쟁력이 된다.

강한 비교 문장:

> **마인드맵은 생각을 펼친다. Nook은 생각의 중심을 찾는다.**

---

# 4. Nook의 핵심 AI 네 가지

| 개념역할                      |                                |
| ------------------------- | ------------------------------ |
| Question Reframing        | 흩어진 말을 현재 중심 질문으로 재정의          |
| Shift Detection           | 질문 자체가 이동한 순간만 잡음              |
| Intentional Closure       | 더 물을 수 있어도 지금 정리할 가치가 있는 순간 판단 |
| Thought Path Accumulation | 대화방이 아니라 질문 경로를 저장             |

핵심 철학:

> **많이 생성하는 AI가 아니라, 무엇을 남기지 않을지 판단하는 AI.**

---

# 5. 세션 전체 흐름

```text
Raw Thought
↓
Start Reframe
↓
사용자 확인
↓
Node 0
↓
Reflection
↓
Judge
↓
┌ SHIFT
├ CHECK
├ REFLECT
└ CLOSE
↓
필요하면 Shift Proposal
↓
사용자 확인/수정
↓
Thought Path
↓
Closure
```

PRD상의 세션 단계도 Raw Thought → Reframe → Reflection → Judge → Shift Proposal → 사용자 확인 → Thought Map → Closure 순서로 확정돼 있다.

---

# 6. 모든 Node의 절대 규칙

**AI가 제안하고 사용자가 확정한다.**

Node 0도 예외가 아니다.

AI가 만든 문장은 즉시 “사용자의 생각”으로 저장하면 안 된다.

Question Node에는 반드시:

```text
AI proposed_text
user final_text
```

두 값을 모두 저장한다.

이유:

- AI 제안 승인률 측정
- 사용자의 수정률 측정
- AI 과잉해석 여부 확인

Question Node는 **지나온 사고의 역사이므로 append-only 성격**, Clarification은 현재 이해이므로 수정 가능하다.

---

# 7. Shift Detection — 제품의 핵심

판정 기준:

> **새로운 이야기가 나왔는지가 아니라, 기존 질문에 답해도 사용자의 핵심 고민이 더 이상 해결되지 않는 상태인가.**

Shift는:

> “처음 질문이 사실 가짜였다”

가 아니다.

> **대화하면서 사용자가 지금 풀고 싶은 중심 질문이 달라진 것**

이다.

판정 4문:

```text
Q1. 기존 질문의 세부조건·증거·정보 확인인가?
YES → NOT SHIFT

Q2. 기존 질문에 답해도 새 고민이 남는가?
NO → NOT SHIFT

Q3. 질문의 대상·기준·레벨 중 하나 이상 달라졌는가?
NO → NOT SHIFT

Q4. AI가 끌고 간 것이 아니라
사용자 발화에서 반복·강조됐는가?
NO → 보류
YES → SHIFT 후보
```

**Q4가 Gate.**

사용자가 AI 질문에:

> “그럴 수도 있겠네요.”

정도만 한 것은 Shift 근거가 아니다.

판정은 한 문장이 아니라 **최근 3\~4턴의 흐름**을 본다.

---

# 8. Shift 오류 정책

Nook은 일반 AI보다 False Positive 비용이 매우 크다.

오류 치명도:

```text
1. NOT SHIFT인데 SHIFT로 판단
2. CHECK여야 하는데 SHIFT
3. 실제 Shift를 늦게 발견
```

따라서:

> **False Negative는 어느 정도 허용하고 False Positive를 강하게 줄인다.**

놓친 Shift는 다음 턴에서 잡을 수 있다.

하지만 AI가 사용자가 하지 않은 고민을 만들어 지도에 넣으면 사용자는 자기 지도를 믿지 못한다.

---

# 9. CHECK

Shift가 애매하면 Node를 만들지 않는다.

사용자에게:

> 지금 이야기가 처음 질문에서 조금 다른 쪽으로 가는 것 같기도 해요.

버튼:

```text
[여전히 처음 질문이 중심이에요]
[이쪽이 더 궁금해졌어요]
```

두 번째를 선택하면 사용자가 직접 중심 이동을 선언한 것이므로 다음 Judge의 강한 근거가 된다.

CHECK 자체는 Node가 아니다.

별도 **Check Event**로 저장한다.

필드:

```text
id
session_id
current_node_id
candidate_direction
user_choice
  CURRENT_QUESTION | NEW_DIRECTION
evidence_turns
created_at
```

세션당 최대 2회.

---

# 10. Reframe 규칙

요약과 다르다.

X:

> 상대의 변화에 대해 이야기했어요.

O:

> 나는 상대가 변하기를 기다리고 있는 걸까?

허용:

> **사용자가 여러 번 말한 재료를 하나의 질문으로 묶기**

금지:

> **사용자가 말하지 않은 원인·성향·심리 해석 추가**

예:

```text
사용자:
지금은 잘해준다
앞으로 달라질 수도 있다
조금 기다려보고 싶다

→ 나는 상대가 변하기를 기다리고 있는 걸까?
허용
```

반면:

```text
내가 너무 예민한 걸까?

→ 나는 내 감정을 신뢰하지 못하는 걸까?
금지
```

없는 심리 의미를 추가했기 때문이다.

---

# 11. 모든 사용자-facing 카피 규칙

Reframe 규칙은 Node에만 적용되지 않는다.

다음 전부 동일:

- Closure
- Clarification
- Shift Evidence
- Safety
- 안내 문구
- 재방문 문구
- 시스템 메시지

원칙:

> **서비스는 관찰된 것 이상을 말하지 않는다.**

금지 예:

```text
여기서 멈추면 나중에 더 잘 보여요.
계속 생각하면 선명함을 잃을 수 있어요.
이건 고민할 일이 아니에요.
드시고 싶으면 드세요.
```

---

# 12. Depth Guard

Nook은 자기분석/상담 앱이 아니다.

AI가 따라갈 수 있는 범위:

```text
행동/선택
↓
원하는 것
↓
우선순위
↓
현재 기대·전제
```

AI가 먼저 열면 안 되는 것:

```text
애착유형
트라우마
어린 시절
결핍
무의식
성격 진단
"나는 왜 이런 사람인가"
```

원칙:

> **자기이해를 만들기 위해 깊게 파지 않는다. 생각을 선명하게 하다 보니 자기이해가 생길 수는 있다.**

---

# 13. Branch / 남겨둔 질문

Shift가 아니지만 새로 나온 질문은 **Branch**.

Branch는 다음 대화 액션과 별개다.

즉:

```text
Branch 발견
↓
Pile 저장
↓
대화는 계속
```

Branch가 나온 턴이라고 대화를 중단하면 안 된다.

Branch는 실시간으로 펼쳐 보여주지 않는다.

시야에서는 치운다.

나중에 같은 방향을 사용자가 반복·강조하면 **Branch → Shift 승격 가능**.

사용자 UI 이름:

> **남겨둔 질문**

“미해결 질문”이라고 부르지 않는다.

---

# 14. 남겨둔 질문의 동작

동작은 딱 두 개.

```text
[여기서 시작하기]
[삭제]
```

`여기서 시작하기`:

- 해당 질문이 새 Thought Session의 Raw Thought가 됨
- 원본 session/node와 연결을 유지
- 나중에:
  > “9월 9일에 남겨둔 질문에서 이어졌어요.”
  > 같은 표시 가능

삭제:

> **확인 후 영구 삭제**

별도 archive/hide/soft-delete 없음.

삭제 확인:

> 이 질문을 삭제할까요?
> 삭제하면 다시 볼 수 없어요.

Pile 상태:

```text
ACTIVE
RESUMED
```

삭제하면 실제 DB row 삭제.

---

# 15. 단순 질문 — CLEAR\_AS\_IS

모든 입력을 억지로 Reframe하지 않는다.

Prompt A는:

```text
REFRAME_NEEDED
CLEAR_AS_IS
```

둘 중 하나를 반환한다.

예:

```text
오늘 치킨 먹을까?
우산 가져갈까?
지금 커피 마실까?
```

→ `CLEAR_AS_IS`

화면:

> 지금 질문은 이미 분명해 보여요.
> `오늘 치킨을 먹을까?`

```text
[여기까지 정리하기]
[조금 더 생각해보기]
```

절대로:

> “그건 고민할 일이 아니에요.”

라고 하지 않는다.

또:

> “먹고 싶으면 드세요.”

처럼 결정을 대신하지 않는다.

중요:

**표면적으로 가벼운 주제인지가 기준이 아니다.**

```text
오늘 치킨 먹을까?
→ CLEAR_AS_IS

요즘 자꾸 시켜 먹는데 이래도 되나
→ REFRAME_NEEDED

치킨 먹을까 말까 30분째 고민 중
→ REFRAME_NEEDED
```

기준은:

> **사용자 발화 자체에 정리되지 않은 갈등이 존재하는가.**

---

# 16. Safety Architecture

Safety는 Judge 안에 넣지 않는다.

현재 실행 순서:

```text
사용자 발화
↓
1. OpenAI Moderation
↓
2. 별도 Safety Classifier
↓
NONE
→ Turn Judge

AMBIGUOUS / HIGH_RISK
→ Safety Flow
```

Safety Classifier는 Judge와 완전히 분리한다.

Safety는 다른 판정과 반대로 **놓치는 것보다 오탐을 어느 정도 허용**한다.

---

# 17. Safety가 걸리면 중단할 것

전부 중단:

```text
Reflection
Shift
Node 생성
지도 갱신
```

즉 **Nook의 핵심 메커니즘 자체를 끈다.**

---

# 18. Safety 카피

하지 않을 것:

```text
진단
되묻기
상태 확인 질문
조언
평가
```

예:

X:

> 우울하신 것 같아요.
> 무슨 일이 있으셨어요?
> 많이 힘드신 상태네요.

기본형:

> **지금은 질문을 더 이어가지 않을게요.**
> **바로 도움을 받을 수 있는 연락처를 안내할게요.**

짧게 유지한다.

---

# 19. Safety 연락처

상황별로 필요한 것만 표시.

| 상황연락처   |                                  |
| ------- | -------------------------------- |
| 자살·자해   | 자살예방 상담전화 **109**, 급한 상황 **119** |
| 청소년     | 청소년 상담전화 **1388**                |
| 폭력 피해   | 여성긴급전화 **1366**                  |
| 일반 정신건강 | 정신건강 상담전화 **1577-0199**          |

고정 리스트를 전부 보여주지 않는다.

---

# 20. Safety 이후 UX

Safety 화면에는:

```text
[새 생각 시작하기]
```

하나.

`계속하기` 버튼 없음.

현재 세션은 닫고 새로운 세션을 연다.

같은 위험 표현을 다시 입력하면 다시 Safety Gate를 탄다.

“다른 이야기로 시작하기”라는 표현은 쓰지 않는다. 방금 한 이야기가 부적절했다는 인상을 줄 수 있어서다.

---

# 21. Safety 저장 규칙

현재 확정:

```text
session.status = SAFETY_STOPPED
```

사용자 화면:

```text
지나온 생각 → 노출 안 함
남겨둔 질문 → 노출 안 함
```

단, 세션 전체 DB 데이터를 강제로 지우지는 않는다.

이유:

> Safety는 오탐 허용 정책이므로 마지막 한 발화가 걸렸다고 20분간 만든 정상 기록 전체를 삭제하면 안 된다.

반면 **Safety를 일으킨 위험 원문 자체는 저장하지 않는다.**

Judge Log에도 원문 저장하지 않는다.

저장:

```text
session_id
status = SAFETY_STOPPED
safety_category
trigger_source
created_at
```

---

# 22. Closure

세 종류.

### Soft Closure

AI가 현재 질문이 충분히 선명해졌다고 판단했을 때:

> 처음에는 “이직할까?”에서 시작했고,
> 지금은 “성장할 환경을 찾는 걸까?”까지 왔어요.

```text
[여기까지 정리하기]
[이 질문 조금 더 보기]
```

### Structural Transition

Node / Turn / Branch 상한에 도달.

사용자를 그만두게 하는 게 아니라 **사고 단위를 새 구간으로 나눔**.

```text
[이 질문에서 이어가기]
[여기까지 정리하기]
```

### Safety Stop

Safety Flow.

여기만 `계속 보기`가 없음.

Intentional Closure:

> **더 이상 질문할 수 없는 순간이 아니라, 더 질문할 수 있어도 지금 정리할 가치가 있는 순간을 알아차리는 것.**

---

# 23. Segment / Anchor

한 Thought Path가 길어지면 여러 **구간(Segment)** 으로 나눈다.

사용자에게:

```text
Map 1
Map 2
```

라고 하지 않는다.

하나의 생각 흐름이다.

새 Segment는 Node 0을 새로 만들지 않는다.

> **이전 Segment의 마지막 confirmed Node를 Anchor로 참조**

DB에서 Node를 복제하지 않는다.

Segment 2를 단독 렌더할 때만 이전 Node를 anchor preview로 보여준다.

---

# 24. Structural Limits

**한 Segment**

```text
Main Node 최대 4개
= Start 1 + Shift 3

Turn 최대 20

Branch 최대 5
```

**한 Session**

```text
MEDIUM CHECK 최대 2
```

Clarification 표시:

```text
한 구간 2~3개
```

4라는 숫자는 사용자 목표가 아니다.

화면에서:

```text
1/4
50%
progress bar
```

같은 표시 절대 금지.

---

# 25. 지도에 보이는 다섯 요소

| 요소의미             |                  |
| ---------------- | ---------------- |
| Main Node        | 질문 자체의 이동        |
| Clarification    | 같은 질문 안에서 선명해진 것 |
| Shift Evidence   | 왜 다음 Node로 이동했는가 |
| Pile Indicator   | 따라가지 않은 질문 개수    |
| Current Question | 현재 묻고 있는 질문      |

---

# 26. Clarification

Main Node와 다르다.

Main Node:

> 질문이 이동함.

Clarification:

> 질문은 그대로지만 범위가 좁아지거나 구분이 생김.

허용:

```text
회사 자체가 싫은 것은 아님
반복 업무가 계속 걸림
```

금지:

```text
결국 성장 욕구가 충족되지 않는 것이 핵심
```

사용자가 안 한 결론이기 때문.

Clarification:

```text
HIGH confidence만 화면 반영
한 구간 2~3개
mutable
```

사용자 말이 나중에 바뀌면 교체/삭제 가능.

---

# 27. 지도에서 절대 하지 않을 것

```text
턴마다 dot 추가
진행률
완성도 게이지
생각 정리 중 가짜 animation
Branch 내용 실시간 펼침
대화량을 진전처럼 표시
```

원칙:

> **아무것도 선명해지지 않았으면 아무것도 추가하지 않는 것이 정확한 시각화다.**

---

# 28. Shift 0 세션

Shift가 하나도 없어도 정상.

예:

> 처음 질문은 그대로예요. `이직할까?`
> 대신 이야기하면서 몇 가지가 분명해졌어요.

Clarification을 보여준다.

> **질문은 바뀌지 않았지만 처음보다 범위가 좁아졌어요.**

False Positive를 줄이면 Shift 0은 자연스럽게 생긴다.

---

# 29. 지나온 생각

완료된 Thought Session 자체가 **지나온 생각**이다.

별도 Archive 테이블 생성하지 않는다.

Shift 있음:

```text
9월 9일
이직할까?
→ 지금 회사에서 원하는 성장이 가능한가?
```

Shift 0:

```text
9월 9일
이직할까?
반복 업무가 계속 걸린다는 점이 분명해짐
```

새 요약 생성하지 않고 저장된 Clarification 하나를 참조한다.

상세:

```text
Thought Path
Main Nodes
Shift Evidence
Clarifications
남겨둔 질문
```

전체 Chat transcript는 기본으로 보여주지 않는다.

반복 질문 감지:

> **MVP에서 제외.**

---

# 30. 성장감 관련 금지

시스템이:

```text
성장했어요
많이 달라졌어요
깊이 생각했어요
```

라고 평가하지 않는다.

또:

```text
이번 달 질문 12개
지난달보다 +3
7일 연속
질문 개수 그래프
```

같은 양적 gamification 금지.

> **쌓인 양을 보여주지 말고 쌓인 내용 자체를 보여준다.**

---

# 31. 홈

신규 사용자와 기존 사용자가 같은 Home을 사용한다.

상단:

```text
머릿속에 걸리는 게 있나요?
정리하지 말고 생각나는 대로 적어주세요.

[입력창]

예시 칩
```

아래:

```text
지나온 생각
최근 2~3개

남겨둔 질문 N개
```

기존 기록을 첫 화면 주인공으로 만들지 않는다.

예시 칩은 Demo mode가 아니다.

클릭하면 실제 Raw Thought로 동일한 흐름을 탄다.

현재 후보:

```text
이직하고 싶은데 이유를 모르겠어
계속 만나는 게 맞는지 모르겠어
사고 싶은데 계속 망설여져
그냥 머릿속이 복잡해
```

단, **최종 칩은 Shift 발생 여부를 실제 테스트 후 결정**.

---

# 32. 인증 UX

첫 화면에서 로그인하지 않는다.

```text
익명 user
↓
Thought Session
↓
지도 완성
↓
"이 생각을 남겨둘까요?"
↓
[저장하기] [그냥 나가기]
↓
Google / Kakao
```

저장 안 하고 나가는 것도 정상 경로.

---

# 33. 인증 구현

Supabase Anonymous Auth를 사용.

익명 사용자가 처음부터 Supabase User ID를 가진다.

나중에 Google/Kakao OAuth identity를 **같은 user에 연결**.

즉:

```text
anonymous user A
↓
session 생성
↓
OAuth 연결
↓
user A 유지
```

별도 “익명 데이터 → 로그인 계정 데이터 migration”을 만들지 않는 방향.

앱에서 이메일 문자열을 비교해서 임의로 계정을 merge하지 않는다.

카카오는 이메일이 없을 수도 있다.

---

# 34. 기술 스택 — LOCK

이제 변경하지 않는다.

```text
Language
TypeScript

Frontend
React

Framework
Next.js App Router

UI
SEED React

Package manager
npm

DB
Supabase PostgreSQL

Auth
Supabase Auth

AI
OpenAI

Validation
Zod

Server/API
Next.js app/api/

Deployment
Vercel

Repository
GitHub
```

별도 Backend server:

> **없음.**

PRD에서도 Next.js 한 프로젝트 안의 `app/api/` 구조로 확정돼 있다.

---

# 35. 왜 별도 Backend를 만들지 않는가

이번에는 시간이 부족하기 때문.

별도 서버를 만들면:

```text
배포 2개
환경변수 2벌
도메인 2개
CORS
Auth token 전달
장애 지점 증가
```

가 생긴다.

서비스 로직을 분리하는 것과 서버를 물리적으로 분리하는 것은 별개의 문제다.

현재는 Next.js 안에서:

```text
UI
API
Engine
Prompt
DB Access
```

를 코드 레벨로 나눈다.

대회 이후 원한다면 API/engine을 별도 서버로 이동 가능.

---

# 36. 넣지 않을 기술

MVP에서는 사용하지 않는다.

```text
Redis
Vector DB
Embeddings
Prisma
ORM
Docker
NestJS
Fastify
Express 별도 서버
GraphQL
Redux
별도 Analytics SaaS
```

필요가 생겼을 때 추가한다.

---

# 37. SEED Design

일반 UI는 **SEED React**를 사용.

예상:

```text
Button
Input
Textarea
Chip
Dialog
Bottom Sheet
Toast
Navigation
Loading
```

Nook 고유 UI만 Custom:

```text
ThoughtPath
QuestionNode
CurrentQuestion
Clarification
ShiftEvidence
SegmentAnchor
PileIndicator
```

SEED AI Skill 설치 명령:

```bash
npx skills add https://github.com/daangn/seed-design --skill seed-design
```

터미널에서는 마크다운 링크가 아니라 위 순수 URL 사용.

---

# 38. AI Prompt 구조

총 **4개 Core Prompt + 별도 Safety Classifier**.

### Prompt A — Start Reframe

```text
Raw Thought
→ REFRAME_NEEDED
or CLEAR_AS_IS
```

사용자 발화 재료만 사용.

---

### Prompt B — Turn Judge

입력:

```text
현재 Main Question
최근 3~4턴
Main Path
현재 Pile/Branch
최근 Check Event
```

출력:

```json
{
  "action": "CLOSE | SHIFT | CHECK | REFLECT",
  "branches": [],
  "clarification": null,
  "shift_confidence": "HIGH | MEDIUM | LOW",
  "evidence_turns": []
}
```

Judge는 **문장을 잘 쓰는 역할이 아니다. 판정만 한다.**

---

### Prompt C — Shift Reframe

Judge가 SHIFT일 때만.

```text
새 중심 질문
+
한 줄 Shift Evidence
```

사용자 발화만 근거.

---

### Prompt D — Reflection Generator

Judge가 REFLECT일 때만.

역할:

> 실제로 사용자에게 할 질문 하나 생성.

규칙:

```text
현재 Main Question 변경 금지
한 번에 한 질문
새 심리 원인 발굴 금지
현재 질문의 모호한 부분만 좁힘
```

---

# 39. Judge 결과 구조

Branch는 `action`이 아니다.

**side effect**다.

예:

```json
{
  "action": "REFLECT",
  "branches": [
    {
      "text": "연봉이 얼마나 중요한지",
      "evidence_turns": ["U3"]
    }
  ],
  "clarification": {
    "text": "회사 자체가 싫은 것은 아님",
    "evidence_turns": ["U2"],
    "confidence": "HIGH"
  },
  "shift_confidence": "LOW",
  "evidence_turns": ["U2", "U3"]
}
```

`evidence_turns`는 **USER turn만 허용**.

AI가 자기 질문을 근거로 다시 Shift를 만드는 순환을 막는다.

---

# 40. Zod

OpenAI 출력은 그대로 신뢰하지 않는다.

Judge 등 structured output은 Zod schema로 검증.

예:

```ts
const JudgeResultSchema = z.object({
  action: z.enum(["CLOSE", "SHIFT", "CHECK", "REFLECT"]),
  shift_confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
});
```

잘못된 응답을 DB에 직접 쓰지 않는다.

---

# 41. AI 모델 사용 원칙

모델 2단계.

저가 모델:

```text
Turn Judge
Reflection
Branch / Clarification
```

고성능 모델:

```text
Node 0 Reframe
Shift Reframe
```

비용을 쓰는 핵심 기준:

> **사용자의 지도에 영구히 남는 문장을 만들 때 더 좋은 모델 사용**

Judge에서 False Positive가 많으면 이후 모델을 올린다.

---

# 42. API 비용 최적화

Judge에 전체 채팅을 매번 보내지 않는다.

필요한 것:

```text
현재 질문
최근 3~4턴
Main Path
Clarification
Pile
Check Event
```

Structural Check를 AI에게 시키지 않는다.

코드에서 처리:

```text
node_count
turn_count
branch_count
check_count
```

---

# 43. ERD — 현재 개념 구조

```text
AUTH USER
│
├── THOUGHT SESSION
│   │
│   ├── SEGMENT
│   │   │
│   │   └── QUESTION NODE
│   │       │
│   │       ├── CLARIFICATION
│   │       │
│   │       └── SHIFT EDGE
│   │
│   ├── MESSAGE
│   ├── CHECK EVENT
│   ├── JUDGE LOG
│   └── SESSION FEEDBACK
│
└── PILE ITEM
    │
    └── can resume
        ↓
      NEW THOUGHT SESSION
```

현재 entity도 이 구조로 정의돼 있다.

---

# 44. ERD Entity

### User

Supabase `auth.users`.

앱에 불필요한:

```text
성별
나이
고민 카테고리
프로필
```

등 저장하지 않는다.

---

### Thought Session

한 번의 생각 흐름.

status:

```text
ACTIVE
COMPLETED
SAFETY_STOPPED
```

---

### Segment

긴 Session의 사고 구간.

```text
previous_segment_end_node_id
```

로 Anchor 연결.

---

### Message

실제 대화.

UI에서는 전체 transcript를 기본 노출하지 않더라도 내부 처리용으로 필요.

단 Safety trigger 원문은 저장하지 않는다.

---

### Question Node

```text
START
SHIFT
```

AI proposal + user confirmed text 저장.

---

### Shift Edge

```text
from_node
to_node
shift evidence
user evidence turns
```

---

### Clarification

```text
node
text
confidence
evidence
is_current / valid
display_order
```

mutable.

---

### Check Event

앞서 정의한 CHECK 데이터.

---

### Pile Item

```text
ACTIVE
RESUMED
```

원본:

```text
source_session_id
source_node_id
```

재개:

```text
resumed_session_id
```

---

### Session Feedback

종료 설문.

```text
CLEARER
SAME
UNSURE
```

---

### Judge Log

개발용.

사용자-facing history와 분리.

---

# 45. 카운터 위치

중요.

Session:

```text
check_count
```

Segment:

```text
node_count
turn_count
branch_count
```

Session에 turn\_count를 놓으면 Segment 2를 시작한 순간 다시 limit에 걸리므로 안 된다.

---

# 46. Delete / privacy 철학

Nook은 민감한 개인 고민을 다룬다.

원칙:

```text
Private default
삭제권 명확
저장 여부 사용자 선택
회사에 고민 데이터 판매 금지
```

Pile 삭제는 실제 hard delete.

Safety trigger 원문은 저장하지 않음.

공개 기능은 MVP에서 없음.

---

# 47. MVP에 포함하는 것

```text
Raw Thought
Example Chips
Start Reframe
CLEAR_AS_IS
Node approval
Reflection
Turn Judge
Shift Proposal
CHECK
User edit
Clarification
Shift Evidence
Thought Path
Segment
Anchor
Pile
Soft Closure
Structural Transition
Safety Gate
Safety Flow
End screen
Feedback
Social Login
Home
지나온 생각 preview/list/detail
Pile list
Pile resume
Pile delete
origin linkage
```

---

# 48. MVP에서 제외

```text
반복 질문 탐지
Question Graph
Question Book
공개
소셜
다른 사람 질문 가져오기
사람 매칭
Email/password login
MBTI
심리 진단
감정 점수
AI 최종 결정
오늘의 조언
명언
streak
질문 통계
성장 점수
calendar
tag
search
category
마이홈
chat transcript 중심 archive
```

---

# 49. 테스트 전략

Core test set:

```text
SHIFT
NOT SHIFT
Branch
Clarification
CHECK/MEDIUM
AI-induced interpretation
Branch → Shift
Good Closure
Fatigue Closure
Repetition Closure
Depth Guard
외부→내부 억지 Shift
CLEAR_AS_IS
단순하게 보이지만 실제 갈등 있음
```

20개로 시작.

**애매한 경계 사례가 절반 가까이 있어야 함.**

쉬운 케이스만 있으면 Judge 품질을 검증할 수 없다.

---

# 50. Safety Eval

Core 20개와 별도로 작은 Safety test set 필요.

라벨:

```text
NONE
AMBIGUOUS
HIGH_RISK
```

관용 표현 포함:

```text
일 많아서 죽겠다ㅋㅋ
진짜 미쳐버리겠다
```

와 명백한 위험 발화를 섞어서 오탐/미탐을 확인.

현재 구체 Safety Classifier prompt는 아직 미결.

---

# 51. 성공 지표

종료 질문 하나:

> **오늘 시작할 때보다 무엇을 고민하는지 선명해졌나요?**

```text
[네]
[비슷해요]
[잘 모르겠어요]
```

시작 시 상태 점수는 묻지 않는다.

개발 중:

```text
Shift/session
Shift 0 비율
Shift proposal 승인률
사용자 edit 비율
CHECK 빈도
중도 종료
Closure 설문
Safety 발동률 / 오탐
```

중요한 해석:

```text
Shift 0 + 선명해짐
→ 성공

Shift 여러 개 + edit 많음
→ 과잉해석

Shift 여러 개 + 승인 높음 + 선명해짐
→ 이상적
```

---

# 52. 개발 언어/프레임워크 결정

**React + Next.js + TypeScript 유지.**

이유:

- 사용자층 큼
- 템플릿 풍부
- 레퍼런스 많음
- AI 코딩 지원 좋음
- Vercel 최적
- Supabase/OpenAI 예제 많음
- 별도 backend 없이 server 기능 가능
- Nook처럼 상태가 많은 앱에서 TypeScript가 유리

Python은 지금 필요 없음.

---

# 53. 패키지 매니저

**npm only.**

이전 문서에 남아 있는:

```text
pnpm validate
pnpm eval
```

은 모두 폐기.

사용:

```bash
npm run validate
npm run eval
```

SEED Skill 설치에서 `npx`를 쓰는 것은 정상이며 package manager 선택과 충돌하지 않는다.

---

# 54. package.json validation

초기에는 별도 Unit Test framework를 붙이지 않는다.

`validate`:

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "validate": "npm run typecheck && npm run lint && npm run build",
    "eval": "tsx scripts/eval-judge.ts"
  }
}
```

의미:

```text
validate
= 코드가 깨지지 않았는가

eval
= Nook의 AI 판단이 맞는가
```

두 테스트는 성격이 다르므로 분리.

추후:

```text
eval:judge
eval:safety
```

로 쪼개고 `eval`에서 둘 다 실행 가능.

---

# 55. AGENTS.md

개발 규칙은 README가 아니라 \*\*저장소 root의 `AGENTS.md`\*\*에 둔다.

README:

> 프로젝트 설명 / 실행법

AGENTS:

> 코딩 에이전트가 항상 지켜야 할 규칙

초기 repository:

```text
/
├ AGENTS.md
├ README.md
├ .env.example
├ .gitignore
├ package.json
├ docs/
│  ├ PRD.md
│  ├ ERD.md
│  └ EVAL_CASES.md
└ src/
```

---

# 56. 코드 품질 규칙

AGENTS에 다음 원칙 적용.

```text
production-quality readable structure
```

기능이 동작한다고 끝내지 않는다.

작업 완료 전에:

```text
중복 제거
의미 있는 이름 적용
함수 책임 분리
컴포넌트 책임 분리
불필요 코드 제거
formatting
validation
```

---

# 57. HTML / 코드 정리 규칙

사용자가 특히 요청한 사항.

GitHub Source Code는 사람이 작성한 것처럼 읽을 수 있어야 한다.

원칙:

```text
거대한 JSX 한 줄 금지
거대한 object 한 줄 금지
page.tsx 비대화 금지
불필요한 div nesting 금지
inline style 최소화
semantic HTML 사용
clickable div 금지
```

다만 **브라우저 “페이지 소스 보기”에 표시되는 Next.js 빌드 HTML의 줄바꿈 자체는 코드 품질 기준으로 삼지 않는다.**

Next.js가 SSR/hydration 과정에서 자동 생성하는 것이기 때문.

기준:

```text
GitHub source가 읽히는가
DOM이 의미 있게 구성됐는가
client JS가 불필요하게 많지 않은가
```

---

# 58. Server/Client component 원칙

Next.js에서:

> 기본 Server Component.

`"use client"`는:

```text
브라우저 state
event handler
browser API
```

가 필요한 경우만.

전체 page를 습관적으로 Client Component로 만들지 않는다.

---

# 59. 코드 레이어 구조

권장:

```text
src/
├ app/
│  ├ page.tsx
│  ├ session/
│  ├ thoughts/
│  ├ pile/
│  └ api/
│
├ components/
│  ├ ui/
│  └ nook/
│
├ engine/
│  ├ judge.ts
│  ├ reframe.ts
│  ├ reflection.ts
│  └ safety.ts
│
├ schemas/
│
├ lib/
│  ├ openai/
│  └ supabase/
│
├ prompts/
│  ├ start-reframe.ts
│  ├ turn-judge.ts
│  ├ shift-reframe.ts
│  ├ reflection.ts
│  └ safety.ts
│
└ types/
```

OpenAI/Supabase 호출을 React 컴포넌트 안에서 직접 처리하지 않는다.

UI와 engine을 섞지 않는다.

---

# 60. 환경변수/보안

`.env.local`은 Git에 올리지 않는다.

`.env.example`만 올린다.

OpenAI key:

> **절대 client에 노출하지 않음.**

OpenAI API 호출은 서버 코드에서만.

Supabase도 server-only key와 browser-safe key를 구분.

API 비용 안전장치:

```text
OpenAI 자동 충전 OFF
소액 선불
IP/request rate limit
```

PRD에서도 API key server-only 및 비용 안전장치가 명시돼 있다.

---

# 61. 현재 개발 우선순위

1.

> **AI 엔진 품질**

2.

> Thought Path가 정확히 남는 것

3.

> 지나온 생각 재열람

4.

> 남겨둔 질문에서 다시 시작

화면은 엔진 뒤.

---

# 62. 실제 일정

현재 계획:

| 날짜작업      |                               |
| --------- | ----------------------------- |
| 09.09\~10 | 계정·키 · ERD · 테스트셋             |
| 09.11\~13 | Prompt + eval + 오답 분석 + 1차 배포 |
| 09.14\~16 | Session UI                    |
| 09.17     | Home / 지나온 생각 / 남겨둔 질문        |
| 09.18     | **참가 신청 마감**                  |
| 09.19\~20 | 최종 배포/버그/카피                   |

하지만 **현재 실제 실행 순서는 조금 변경**했다.

가장 먼저:

> **프로젝트 초기화 + 첫 Vercel 배포**

를 한다.

배포 URL을 먼저 살아 있게 만든다.

---

# 63. 지금부터 정확한 작업 순서

### STEP 1 — 지금

**Project Initialization + First Deployment**

목표:

> 기능 개발이 아니라 deployment pipeline 확인.

할 것:

```text
existing GitHub repo 사용

Next.js
React
TypeScript
npm
SEED
Zod
Supabase SDK
OpenAI SDK

AGENTS.md
README.md
docs/PRD.md
.env.example

typecheck
lint
build
validate
```

화면은:

> “머릿속에 걸리는 게 있나요?”

입력창 하나 정도면 충분.

그 상태에서 Vercel 배포.

**실제 URL이 열리는 것까지 완료해야 STEP 1 종료.**

배포 URL이 확보되어야 Kakao OAuth redirect 설정에도 활용 가능.

---

# 64. STEP 2

**ERD + Supabase**

그림만 만드는 것으로 끝내지 않는다.

최종 산출물:

```text
1. ERD
2. Table specification
3. 관계/FK
4. Nullable
5. ENUM/status
6. delete/cascade rules
7. RLS
8. Supabase SQL migration
```

특히 확인:

```text
Session → Segment
Segment → Node
Segment Anchor
Node → Clarification
Node → Shift Edge
Pile → source Session/Node
Pile → resumed Session
Safety hidden Session
User ownership
```

---

# 65. STEP 3

Claude와 Core Evaluation Set 20개 작성.

프롬프트보다 테스트셋을 먼저 작성.

프롬프트를 먼저 만들면 규칙에 맞는 문제만 만들게 되는 편향 위험이 있음.

---

# 66. STEP 4

Prompt + Engine.

순서:

```text
Safety
↓
Explicit User Control
↓
Structural Check
↓
Judge
↓
Reframe / Reflection
↓
User choice
```

현재 PRD도 이 구조로 확정돼 있다.

---

# 67. STEP 5

Session UI.

우선:

```text
Raw Thought
Start Reframe
Node confirm
Reflection
CHECK
Shift confirm/edit
Thought Map
Closure
```

Home/Archive보다 먼저.

---

# 68. STEP 6

재방문 구조.

```text
Home
지나온 생각
Thought Detail
남겨둔 질문
Pile resume
Social login/save
```

---

# 69. STEP 7

09.18 신청.

09.19\~20:

```text
Bug fix
Mobile
Copy
Deployment check
```

이때는 **새 기능 추가 금지**.

---

# 70. 현재 미결

PRD 기준 남은 핵심 미결은 네 개다.

```text
Safety Classifier 구체 prompt
예시 Chip 4개 최종 선정
Email login 추가 시점
Nook 상표/도메인 확인 (대회 이후)
```

추가로 개발하면서 확정할 것:

```text
정확한 ERD field/type
RLS
API route 구조
OpenAI 실제 모델
Safety eval threshold
```

---

# 71. 개발 에이전트가 임의로 바꾸면 안 되는 것

특히 중요.

Codex/Work는 아래 내용을 “더 좋은 UX”라는 이유로 임의 수정하지 않는다.

```text
답을 추천하지 않음

AI가 사용자 심리 해석을 추가하지 않음

False Positive Shift를 강하게 억제

Node는 사용자 승인 필요

Clarification과 Node 분리

CHECK는 Node가 아님

Branch는 action이 아니라 side effect

Branch 실시간 노출 금지

Progress UI 금지

Safety를 Judge 내부에 넣지 않음

Safety에서 일반 conversation 계속 버튼 없음

Pile은 hard delete

Safety Trigger 원문 미저장

첫 화면 로그인 없음

별도 backend 서버 없음

npm only

SEED 기반

이전 Segment의 마지막 Node는 복제하지 않고 Anchor reference

대화 transcript 중심 archive 금지

반복 질문 탐지는 MVP 밖
```

---

# 72. 제품 철학 압축본

개발 중 판단이 애매하면 아래 문장 기준으로 결정한다.

> **답을 대신 내리지 않는다.**

> **안전과 종료를 먼저 본다.**

> **새 내용이 아니라 중심 질문의 이동을 본다.**

> **사용자가 이동하지 않았다면 AI가 이동을 만들어내지 않는다.**

> **애매하면 노드를 만들지 않는다.**

> **사용자가 말한 것은 묶을 수 있지만 없는 원인·성향은 만들지 않는다.**

> **자기이해가 결과로 생기는 것은 괜찮지만 자기분석을 목적으로 파지 않는다.**

> **사용자의 고민을 별거 아니라고 평가하지 않는다.**

> **더 많이 열지 않고 지금 중요한 질문 하나를 선명하게 한다.**

> **생각의 양이 아니라 생각의 내용을 남긴다.**

> **지도는 진행률이 아니라 사고의 흔적이다.**

최종 품질 정의:

> **좋은 AI는 많은 통찰을 만드는 AI가 아니라, 사용자가 실제로 이동한 생각만 정확히 붙잡고 사용자가 하지 않은 해석은 만들지 않는 AI다.**

---

## 그리고 Codex 첫 메시지는 이걸 쓰면 돼

아래 정도면 방금 정리한 문서를 `docs/`에 넣은 다음 실제 작업을 시작하기 충분해.

```text
Nook 프로젝트 개발을 시작한다.

먼저 저장소의 AGENTS.md와 docs/PRD.md를 전부 읽고,
그 문서에 확정된 제품 원칙과 기술 결정을 임의로 변경하지 않는다.

현재 단계는 STEP 1 — 프로젝트 초기화 + 첫 배포다.

기술 스택:
- TypeScript
- React
- Next.js App Router
- npm only
- SEED React
- Zod
- Supabase
- OpenAI
- Vercel

별도 백엔드 서버를 만들지 않는다.
서버 로직은 Next.js app/api와 별도 engine/service 모듈로 구성한다.

이번 작업의 목표는 제품 기능 구현이 아니라
GitHub → Next.js → Vercel → 환경변수 구조가 정상 작동하는지
최대한 빨리 검증하는 것이다.

수행:
1. 기존 GitHub 저장소를 기반으로 Next.js + TypeScript 프로젝트 초기화
2. npm 기준으로 패키지 관리
3. SEED React 적용 기반 준비
4. Supabase/OpenAI SDK 연결 구조 준비
5. Zod 설치
6. AGENTS.md 개발 규칙 적용
7. docs/PRD.md 유지
8. .env.example 작성
9. typecheck 스크립트 추가
10. validate = typecheck + lint + build
11. Nook 첫 화면의 최소 UI 구현
   - "머릿속에 걸리는 게 있나요?"
   - 입력창
12. Prettier/ESLint/TypeScript 오류 정리
13. npm run validate 통과
14. Vercel 첫 배포

코드 품질:
- 화면과 business logic 분리
- 거대한 page.tsx 금지
- 의미 있는 component/function 이름
- semantic HTML
- 불필요한 div nesting 금지
- 기본 Server Component
- 필요한 경우에만 use client
- API key client 노출 금지
- 불필요한 package 추가 금지

기능이 동작하면 바로 끝내지 말고
중복 제거 → 책임 분리 → formatting → validate를 수행한다.

STEP 1 범위를 넘어 AI Judge나 ERD 구현까지 먼저 진행하지 않는다.

마지막에 아래를 보고한다:
- 생성/변경 파일
- 설치 package
- npm run validate 결과
- 배포 URL
- 아직 필요한 사용자 설정/환경변수
- 다음 STEP에서 해야 할 일
```

이걸 기준으로 넘기면 **지금까지 우리 둘이 몇십 번 왔다 갔다 하면서 잠근 판단을 거의 그대로 들고 시작할 수 있어.**
그리고 중요한 건, 앞으로 새 결정이 생기면 **PRD나 AGENTS에 반영해서 “채팅 기억”이 아니라 저장소 자체가 Nook의 기억이 되게 만드는 것**이야.