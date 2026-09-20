import assert from "node:assert/strict";
import test from "node:test";
import { isConfused } from "../src/engine/confusion.ts";

const user = (...texts: string[]) =>
  texts.map((text) => ({ role: "user" as const, text }));

test("질문이 닿지 않았다고 직접 쓴 말을 센다", () => {
  for (const text of [
    "무슨말인지 모르겠어",
    "무슨 말인지 모르겠어요",
    "뭔 소리야",
    "질문이 이해가 안 돼",
    "뭘 물어보는 거야?",
    "이해가 안 가",
    "말이 어려워요",
    "뭐라는 거야",
  ])
    assert.equal(isConfused(user(text)), true, text);
});

test("되묻기를 그만하라는 말도 센다", () => {
  for (const text of ["그런건 알아서 뭐하게", "왜 자꾸 물어봐", "그만 물어봐"])
    assert.equal(isConfused(user(text)), true, text);
});

test("고민에 대한 모름은 혼란이 아니다", () => {
  // 모름의 대상이 방금의 질문이 아니라 고민 자체이면 훌륭한 답이다.
  for (const text of [
    "내가 성장할 수 있을지 모르겟어",
    "잘 모르겠어",
    "내가 뭘 원하는지 모르겠어",
    "어떤 말을 해야 할지 모르겠어",
    "사수가 생겨야겠지?",
    "지금 회사는 사수도 없고 배우는 게 없거든",
  ])
    assert.equal(isConfused(user(text)), false, text);
});

test("마지막 사용자 발화 하나만 본다", () => {
  // 지난 턴의 혼란은 그때 다뤄졌거나 지나간 것이다.
  const turns = [
    { role: "user" as const, text: "무슨말인지 모르겠어" },
    { role: "assistant" as const, text: "지금 어떤 마음이 들어요?" },
    { role: "user" as const, text: "회사에서 배우고 싶어" },
  ];
  assert.equal(isConfused(turns), false);
});

test("발화가 없으면 신호도 없다", () => {
  assert.equal(isConfused([]), false);
  assert.equal(
    isConfused([{ role: "assistant", text: "무슨 말인지 모르겠어요" }]),
    false,
  );
});
