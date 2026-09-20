import assert from "node:assert/strict";
import test from "node:test";
import {
  isNonAnswer,
  hasMeaningfulCharacter,
} from "../src/engine/non-answer.ts";

const user = (text: string) => [{ role: "user" as const, text }];

test("자모·기호·이모지만 있는 턴을 센다", () => {
  for (const text of [
    "ㅋㅋㅋ",
    "ㅠㅠ",
    "ㅇㅇ",
    "ㄴㄴ",
    "...",
    "!!!",
    "😊",
    "ㅡㅡ",
  ])
    assert.equal(isNonAnswer(user(text)), true, text);
});

test("짧아도 뜻을 실은 글자가 있으면 답으로 본다", () => {
  // 짧아진 것 자체는 stalled가 센다. 두 신호를 섞지 않는다.
  for (const text of [
    "응",
    "네",
    "70",
    "ok",
    "속마음 얘기",
    "책임감 있는 업무",
  ])
    assert.equal(isNonAnswer(user(text)), false, text);
});

test("운영에서 실제로 온 발화를 걸러내지 않는다", () => {
  for (const text of [
    "그런건 알아서 뭐하게",
    "무슨말인지 모르겠어",
    "내가 키우던 크레가 죽은 줄 알았어",
    "죽었는지 확인했지",
    "거기서 배우는 점이 생기겠지?",
    "아 ㅋㅋ 그렇지",
  ])
    assert.equal(isNonAnswer(user(text)), false, text);
});

test("마지막 사용자 발화만 본다", () => {
  const turns = [
    { role: "user" as const, text: "회사를 잘 다닐 수 있을까" },
    { role: "assistant" as const, text: "지금 가장 걸리는 게 뭐예요?" },
    { role: "user" as const, text: "ㅋㅋ" },
  ];
  assert.equal(isNonAnswer(turns), true);
  // AI 발화만 있으면 셀 것이 없다.
  assert.equal(isNonAnswer([{ role: "assistant", text: "ㅋㅋ" }]), false);
  assert.equal(isNonAnswer([]), false);
});

test("합성 문자와 공백을 정규화해서 본다", () => {
  assert.equal(hasMeaningfulCharacter("  \n  "), false);
  assert.equal(hasMeaningfulCharacter("ㅋ ㅋ ㅋ"), false);
  assert.equal(hasMeaningfulCharacter("ㅋㅋ 응"), true);
});
