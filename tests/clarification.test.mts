import assert from "node:assert/strict";
import test from "node:test";
import {
  inspectClarification,
  keepClarifications,
} from "../src/engine/clarification.ts";

test("아직 정해지지 않은 것은 분명해진 것이 아니다", () => {
  for (const text of [
    "도마뱀을 키우고 싶지만 고민 중임",
    "도마뱀을 끝까지 책임지고 키울 수 있을지 확신하지 못함",
    "처음에는 흥미로워서 잘 키울 수 있지만 나중에는 질릴 수 있다고 우려함",
    "회사에서 성장할 수 있을지 모르겠음",
    "도마뱀을 키울지 결정할 때 생활환경과 비용 측면을 확인하려 함",
  ])
    assert.deepEqual(inspectClarification(text), ["UNSETTLED"], text);
});

test("말했다는 사실 자체를 적은 것은 분명해진 것이 아니다", () => {
  for (const text of [
    "키우던 크레가 죽은 줄 알았다고 함",
    "크레가 죽었는지 확인했다고 함",
    "지난 6개월 동안 비슷한 업무를 반복했다고 말함",
  ])
    assert.deepEqual(inspectClarification(text), ["RESTATED"], text);
});

test("기준·배제·확정된 사실은 그대로 남는다", () => {
  // 이 셋이 기준의 경계다. 하나라도 걸리면 화면이 비어 버린다.
  for (const text of [
    "회사를 잘 다니고 있다고 느끼려면 성취가 있어야 함",
    "회사를 잘 다니고 있다고 느끼려면 같이 일하는 사람들이 열정적으로 일해야 함",
    "현재 회사에서 배우는 점이 생겼다고 느끼려면 책임감 있는 업무를 맡아야 함",
    "회사 자체가 싫은 것은 아님",
    "보증금은 모아둔 게 있음",
    "월세가 가장 큰 문제",
    "현재 회사에는 사수가 없음",
    "도마뱀이 죽는 모습을 보는 것이 무서움",
  ])
    assert.deepEqual(inspectClarification(text), [], text);
});

test("걸린 것만 빼고 나머지는 순서대로 남긴다", () => {
  const { kept, dropped } = keepClarifications([
    { text: "회사 자체가 싫은 것은 아님" },
    { text: "성장할 수 있을지 모르겠음" },
    { text: "월세가 가장 큰 문제" },
    { text: "비슷한 업무를 반복했다고 말함" },
  ]);
  assert.deepEqual(
    kept.map((item) => item.text),
    ["회사 자체가 싫은 것은 아님", "월세가 가장 큰 문제"],
  );
  assert.deepEqual(
    dropped.map((item) => item.flags),
    [["UNSETTLED"], ["RESTATED"]],
  );
});

test("문장 가운데 나온 말은 걸리지 않는다", () => {
  // 표지는 문장 끝에서만 본다. `모름`이 안에 박힌 정상 항목을 잃지 않는다.
  assert.deepEqual(
    inspectClarification("모르는 사람과 일하는 것이 가장 큰 부담"),
    [],
  );
  assert.deepEqual(inspectClarification("고민 중인 친구를 돕고 싶은 마음"), []);
});
