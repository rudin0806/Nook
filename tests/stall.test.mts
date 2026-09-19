import { test } from "node:test";
import assert from "node:assert/strict";
import { isStalled, replyLength, STALL_ABSOLUTE } from "../src/engine/stall.ts";

const ai = (text: string) => ({ role: "assistant" as const, text });
const me = (text: string) => ({ role: "user" as const, text });

test("길이는 공백과 종결 부호를 빼고 센다", () => {
  assert.equal(replyLength("주기적인 돌봄들"), 7);
  assert.equal(replyLength("그런건 알아서 뭐하게!!"), 9);
});

test("관찰된 세션 — 두 번 연속 짧아지면 정체", () => {
  // 사용자가 대화를 멈추고 싶다고 보고한 바로 그 흐름이다.
  assert.equal(
    isStalled([
      me("나 도마뱀 키우고 싶은데 고민돼 근데 끝까지 책임질 수 있을지 무서워"),
      ai("어떤 상황을 떠올릴 때 그런 생각이 들어요?"),
      me("처음엔 흥미로워서 잘 키울 수 있지만, 나중에는 질릴 수 있잖아"),
      ai("끝까지 할 수 있을지 모르겠는 일은 뭐예요?"),
      me("주기적인 돌봄들"),
      ai("구체적으로 어떤 일이에요?"),
      me("그런건 알아서 뭐하게"),
    ]),
    true,
  );
});

test("한 번만 짧아진 것은 정체가 아니다", () => {
  assert.equal(
    isStalled([
      me("나 도마뱀 키우고 싶은데 고민돼 근데 끝까지 책임질 수 있을지 무서워"),
      ai("어떤 상황을 떠올릴 때 그런 생각이 들어요?"),
      me("처음엔 흥미로워서 잘 키울 수 있지만, 나중에는 질릴 수 있잖아"),
      ai("끝까지 할 수 있을지 모르겠는 일은 뭐예요?"),
      me("주기적인 돌봄들"),
    ]),
    false,
  );
});

test("원래 짧게 답하는 사람에게는 걸리지 않는다", () => {
  // 자기 기준과 비교하므로 중앙값이 낮으면 기준선도 낮다.
  assert.equal(
    isStalled([
      me("응"),
      ai("어떤 순간에 그래요?"),
      me("아침에"),
      ai("그때 뭐가 제일 걸려요?"),
      me("출근"),
      ai("출근의 어떤 부분이요?"),
      me("사람"),
    ]),
    false,
  );
});

test("답이 계속 길면 정체가 아니다", () => {
  const long = "생각해보니 그건 결국 돈 문제가 아니라 시간 문제인 것 같아";
  assert.equal(
    isStalled([me(long), ai("언제 그래요?"), me(long), ai("또?"), me(long)]),
    false,
  );
});

test("비교할 앞선 발화가 없으면 판정하지 않는다", () => {
  assert.equal(isStalled([me("응"), ai("네?"), me("몰라")]), false);
});

test("짧아졌어도 절대 길이를 넘으면 짧은 답이 아니다", () => {
  // 기준선이 매우 길면 그 절반도 여전히 긴 답일 수 있다.
  const veryLong = "가".repeat(200);
  const half = "나".repeat(STALL_ABSOLUTE + 5);
  assert.equal(
    isStalled([
      me(veryLong),
      ai("q"),
      me(veryLong),
      ai("q"),
      me(half),
      ai("q"),
      me(half),
    ]),
    false,
  );
});
