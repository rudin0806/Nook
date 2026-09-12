/**
 * Prompt B (Turn Judge) 평가
 *
 *   npm run eval              전체 실행
 *   npm run eval -- --dry     모델 호출 없이 fixture 정합성만 검사
 *   npm run eval -- --id J-SHIFT-01,J-EDGE-01
 *
 * 채점 원칙 (EVALSET 0장)
 *   forbidden_keywords   confidence 무관, 나오면 실패
 *   high_only_keywords   나와도 되지만 HIGH면 실패
 *   boundary 모드        통과율에서 제외, 분포만 기록
 */

import { readFileSync } from "node:fs";
import {
  computeHedge,
  HEDGE_THRESHOLD,
  HEDGE_MIN_TURNS,
  type Turn,
} from "../src/engine/hedge.ts";

// ─────────────────────────────────────────────
// 타입
// ─────────────────────────────────────────────

type Expect = "EMPTY" | "NON_EMPTY" | "ANY" | "EXACT";

type ListSpec = {
  expect: Expect;
  reference: string[];
  forbidden_keywords: string[];
  high_only_keywords?: string[];
  forbidden_examples: string[];
  high_only_examples?: string[];
};

export type Fixture = {
  id: string;
  category: string;
  mode: "strict" | "boundary" | "pending";
  source: string;
  input: {
    main_question: string;
    main_path: string[];
    pile: { id: string; text: string }[];
    current_clarifications: { id: string; text: string; confidence?: string }[];
    carryover: {
      turn: string;
      text: string;
      judged: string;
      medium_reason?: string;
    }[];
    turns: Turn[];
  };
  fixture_meta: { history: Turn[]; expected_hedge_speaker: boolean };
  expected: {
    medium_reason?: string;
    accept: string[];
    evidence_must_include: string[];
    evidence_allowed: string[];
    clarifications: ListSpec;
    branches: ListSpec;
    invalidate_clarifications: { expect: Expect; ids: string[] };
    promote_pile_item: { expect: Expect; id: string | null };
  };
  must_not: string[];
  rationale: string;
};

import { judgeOutputSchema, type JudgeOutput } from "../src/schemas/judge.ts";
export type Runner = (
  f: Fixture,
  hedgeSpeaker: boolean,
) => Promise<JudgeOutput>;

// ─────────────────────────────────────────────
// 채점 (순수 함수 — 단위 테스트 가능)
// ─────────────────────────────────────────────

type Failure = { kind: string; detail: string };

/** "SHIFT/HIGH" · "CLOSE/*" 형태를 실제 출력과 대조 */
function matchAccept(accept: string[], out: JudgeOutput): boolean {
  return accept.some((a) => {
    const [act, conf] = a.split("/");
    if (act !== out.action) return false;
    if (conf === "*") return true;
    return conf === out.shift_confidence;
  });
}

function checkList(
  spec: ListSpec,
  items: { text: string; confidence?: string }[] | undefined,
  label: string,
): Failure[] {
  const f: Failure[] = [];
  const list = items ?? [];

  if (spec.expect === "EMPTY" && list.length > 0)
    f.push({
      kind: `${label}_EXPECT`,
      detail: `비어야 하는데 ${list.length}개`,
    });
  if (spec.expect === "NON_EMPTY" && list.length === 0)
    f.push({ kind: `${label}_EXPECT`, detail: "비어 있으면 안 됨" });

  for (const it of list) {
    // 금지어 — confidence 무관
    for (const k of spec.forbidden_keywords) {
      if (it.text.includes(k))
        f.push({
          kind: `${label}_FORBIDDEN`,
          detail: `"${k}" in "${it.text}"`,
        });
    }
    // HIGH 전용 금지어 — 나와도 되지만 HIGH면 실패
    for (const k of spec.high_only_keywords ?? []) {
      if (it.text.includes(k) && it.confidence === "HIGH")
        f.push({
          kind: `${label}_HIGH_ONLY`,
          detail: `"${k}" 가 HIGH로 나옴 (원문 완화형) — "${it.text}"`,
        });
    }
  }
  return f;
}

export function score(f: Fixture, raw: unknown): Failure[] {
  const parsed = judgeOutputSchema.safeParse(raw);
  if (!parsed.success)
    return [{ kind: "SCHEMA", detail: parsed.error.message }];
  const out = parsed.data;
  const e = f.expected;
  const fails: Failure[] = [];

  if (!matchAccept(e.accept, out))
    fails.push({
      kind: "ACTION",
      detail: `기대 ${e.accept.join("|")} / 실제 ${out.action}/${out.shift_confidence ?? "-"}`,
    });

  // 증거
  const ev = out.evidence_turns ?? [];
  for (const m of e.evidence_must_include)
    if (!ev.includes(m)) fails.push({ kind: "EVIDENCE_MISSING", detail: m });
  for (const t of ev)
    if (!e.evidence_allowed.includes(t))
      fails.push({ kind: "EVIDENCE_OUT_OF_RANGE", detail: t });
  for (const t of ev)
    if (/^A\d+$/.test(t))
      fails.push({
        kind: "EVIDENCE_AI_TURN",
        detail: `${t} — AI 발화를 근거로 씀`,
      });

  if (out.action === "CLOSE" && out.shift_confidence)
    fails.push({
      kind: "CLOSE_CONFIDENCE",
      detail: "CLOSE인데 shift_confidence를 붙임",
    });

  fails.push(...checkList(e.clarifications, out.clarifications, "CLARI"));
  fails.push(...checkList(e.branches, out.branches, "BRANCH"));

  if (
    out.shift_confidence === "MEDIUM" &&
    e.medium_reason &&
    out.medium_reason !== e.medium_reason
  )
    fails.push({ kind: "MEDIUM_REASON", detail: "Unexpected reason" });
  for (const item of [...out.clarifications, ...out.branches])
    for (const id of item.evidence_turns)
      if (!e.evidence_allowed.includes(id))
        fails.push({ kind: "EXTRACTION_EVIDENCE", detail: id });

  // 무효화
  const inv = out.invalidate_clarifications ?? [];
  const ivs = e.invalidate_clarifications;
  if (ivs.expect === "EMPTY" && inv.length)
    fails.push({
      kind: "INVALIDATE",
      detail: `없어야 하는데 ${inv.join(",")}`,
    });
  if (ivs.expect === "EXACT") {
    const want = new Set(ivs.ids);
    if (inv.length !== want.size || !inv.every((i) => want.has(i)))
      fails.push({
        kind: "INVALIDATE",
        detail: `기대 ${ivs.ids.join(",")} / 실제 ${inv.join(",") || "없음"}`,
      });
  }

  // 승격
  const pp = out.promote_pile_item ?? null;
  const pps = e.promote_pile_item;
  if (pps.expect === "EMPTY" && pp)
    fails.push({ kind: "PROMOTE", detail: `없어야 하는데 ${pp}` });
  if (pps.expect === "EXACT" && pp !== pps.id)
    fails.push({
      kind: "PROMOTE",
      detail: `기대 ${pps.id} / 실제 ${pp ?? "없음"}`,
    });

  if (pp !== null && !f.input.pile.some((p) => p.id === pp))
    fails.push({ kind: "PROMOTE", detail: "Unknown id" });
  return fails;
}

/** 오류 종류를 치명도로 분류 (RULES 3.3) */
export function severity(f: Fixture, out: JudgeOutput): string[] {
  const wantShift = f.expected.accept.some((a) => a.startsWith("SHIFT"));
  const gotShift = out.action === "SHIFT";
  const errors: string[] = [];
  if (!wantShift && gotShift) errors.push("FALSE_POSITIVE_SHIFT");
  const wantMed = f.expected.accept.includes("REFLECT/MEDIUM");
  if (wantMed && gotShift) errors.push("MEDIUM_TO_HIGH");
  if (wantShift && !gotShift) errors.push("MISSED_SHIFT");
  return errors;
}

// ─────────────────────────────────────────────
// fixture 자체 검사 (--dry)
// ─────────────────────────────────────────────

export function validateFixtures(fx: Fixture[]): string[] {
  const errs: string[] = [];
  if (!fx.length) errs.push("No fixtures selected");
  const seen = new Set<string>();
  for (const f of fx) {
    const at = (m: string) => errs.push(`${f.id}: ${m}`);
    if (seen.has(f.id)) at("중복 id");
    seen.add(f.id);

    const e = f.expected;
    if (
      e.medium_reason &&
      (![
        "SINGLE_SPONTANEOUS",
        "ALL_HEDGED",
        "AI_LED_WITH_USER_MATERIAL",
      ].includes(e.medium_reason) ||
        !e.accept.includes("REFLECT/MEDIUM"))
    )
      at("Invalid expected medium_reason");
    for (const c of f.input.carryover)
      if (
        ![
          "SINGLE_SPONTANEOUS",
          "ALL_HEDGED",
          "AI_LED_WITH_USER_MATERIAL",
        ].includes(c.medium_reason ?? "")
      )
        at("carryover medium_reason required");
    const allowed = new Set(e.evidence_allowed);
    for (const m of e.evidence_must_include)
      if (!allowed.has(m)) at(`must_include ${m} 가 allowed에 없음`);

    const turns = f.input.turns;
    if (turns[turns.length - 1]?.role !== "user")
      at("마지막 턴이 사용자 발화가 아님");

    const us = new Set(turns.filter((t) => t.role === "user").map((t) => t.id));
    const co = new Set(f.input.carryover.map((c) => c.turn));
    for (const a of e.evidence_allowed)
      if (!us.has(a) && !co.has(a))
        at(`allowed ${a} 가 창·carryover 어디에도 없음`);

    for (const a of e.accept)
      if (!/^(SHIFT|REFLECT|CLOSE)\/(HIGH|MEDIUM|LOW|\*)$/.test(a))
        at(`accept 형식 ${a}`);
    if (f.mode === "boundary" && e.accept.length < 2)
      at("boundary인데 accept 후보가 1개");
    if (f.mode !== "pending" && e.accept.length === 0)
      at("accept가 비어 있는데 pending이 아님");

    const pid = new Set(f.input.pile.map((p) => p.id));
    if (
      e.promote_pile_item.expect === "EXACT" &&
      !pid.has(e.promote_pile_item.id!)
    )
      at(`promote 대상 ${e.promote_pile_item.id} 가 pile에 없음`);

    const cid = new Set(f.input.current_clarifications.map((c) => c.id));
    for (const i of e.invalidate_clarifications.ids)
      if (!cid.has(i))
        at(`invalidate 대상 ${i} 가 current_clarifications에 없음`);

    // 금지어 목록 교집합 — 같은 표현이 양쪽에 있으면 정상 MEDIUM 출력까지 오답 처리된다
    for (const key of ["clarifications", "branches"] as const) {
      const spec = e[key];
      const both = (spec.high_only_keywords ?? []).filter((k) =>
        spec.forbidden_keywords.includes(k),
      );
      if (both.length)
        at(
          `${key}: "${both.join('", "')}" 가 forbidden과 high_only 양쪽에 있음`,
        );
    }

    // EXACT 승격은 SHIFT/HIGH 전용
    if (
      e.promote_pile_item.expect === "EXACT" &&
      !e.accept.every((a) => a === "SHIFT/HIGH")
    )
      at("promote EXACT인데 accept에 SHIFT/HIGH가 없음");

    // CLOSE만 기대하면서 confidence를 요구하지 않는지
    const closeOnly = e.accept.every((a) => a.startsWith("CLOSE"));
    if (closeOnly && e.accept.some((a) => !a.endsWith("/*")))
      at("CLOSE 기대값에 confidence가 붙어 있음 — CLOSE/* 로 쓴다");

    // hedge_ratio 실측과 기대 플래그 대조
    const all = [...f.fixture_meta.history, ...turns];
    const h = computeHedge(all);
    if (h.hedgeSpeaker !== f.fixture_meta.expected_hedge_speaker)
      at(
        `hedge_speaker 불일치 — 실측 ${h.hedgeSpeaker} (${h.hedgedCount}/${h.userTurnCount}=${h.ratio.toFixed(2)}) / 기대 ${f.fixture_meta.expected_hedge_speaker}`,
      );
  }
  return errs;
}

/** 임계값 근처에 몰려 있는 케이스를 보여준다 — 임계가 옳은지 판단할 재료 */
function hedgeDistribution(fx: Fixture[]) {
  const rows = fx
    .map((f) => {
      const h = computeHedge([...f.fixture_meta.history, ...f.input.turns]);
      return { id: f.id, ...h };
    })
    .filter((r) => r.ratio >= 0.4 || r.hedgeSpeaker)
    .sort((a, b) => b.ratio - a.ratio);
  if (!rows.length) return;
  console.log(
    `── 완화형 분포 (임계 ${HEDGE_THRESHOLD}, 최소 ${HEDGE_MIN_TURNS}턴) ──`,
  );
  for (const r of rows) {
    const near =
      Math.abs(r.ratio - HEDGE_THRESHOLD) < 0.06 ? "  ← 임계 근처" : "";
    const blocked =
      r.ratio >= HEDGE_THRESHOLD && !r.hedgeSpeaker
        ? "  ← 표본 부족으로 미적용"
        : "";
    console.log(
      `  ${r.id.padEnd(18)} ${r.hedgedCount}/${r.userTurnCount} = ${r.ratio.toFixed(2)}  ${String(r.hedgeSpeaker).padStart(5)}${near}${blocked}`,
    );
  }
  console.log();
}

// ─────────────────────────────────────────────
// 실행
// ─────────────────────────────────────────────

function load(path: string): Fixture[] {
  return readFileSync(path, "utf-8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));
}

export async function run(
  fixturePath: string,
  runner: Runner | null,
  filter?: string[],
) {
  let fx = load(fixturePath);
  if (filter?.length) fx = fx.filter((f) => filter.includes(f.id));

  const errs = validateFixtures(fx);
  if (errs.length) {
    console.log("── fixture 정합성 오류 ──");
    errs.forEach((e) => console.log("  " + e));
    console.log();
  } else {
    console.log(`fixture ${fx.length}개 정합성 통과\n`);
  }
  hedgeDistribution(fx);

  if (errs.length) throw new Error("FIXTURE_INVALID");
  if (!runner) return;

  const scored = fx.filter((f) => f.mode !== "pending");
  const strict = scored.filter((f) => f.mode === "strict");
  const results: { f: Fixture; out: JudgeOutput; fails: Failure[] }[] = [];

  for (const f of scored) {
    const all = [...f.fixture_meta.history, ...f.input.turns];
    const out = await runner(f, computeHedge(all).hedgeSpeaker);
    results.push({ f, out, fails: score(f, out) });
  }

  const strictR = results.filter((r) => r.f.mode === "strict");
  const pass = strictR.filter((r) => r.fails.length === 0).length;

  console.log(`── 결정론적 검사 통과율 (의미 검토 별도) ──`);
  console.log(
    `strict ${pass}/${strict.length} (${((pass / strict.length) * 100).toFixed(1)}%)\n`,
  );

  // 치명도별
  const sev: Record<string, string[]> = {};
  for (const r of strictR) {
    const s = severity(r.f, r.out);
    for (const kind of s) (sev[kind] ??= []).push(r.f.id);
  }
  console.log("── 오류 치명도 ──");
  for (const k of ["FALSE_POSITIVE_SHIFT", "MEDIUM_TO_HIGH", "MISSED_SHIFT"]) {
    const ids = sev[k] ?? [];
    console.log(
      `  ${k.padEnd(22)} ${String(ids.length).padStart(2)}  ${ids.join(", ")}`,
    );
  }

  // 금지어
  const kw = strictR.flatMap((r) =>
    r.fails
      .filter(
        (x) => x.kind.includes("FORBIDDEN") || x.kind.includes("HIGH_ONLY"),
      )
      .map((x) => `${r.f.id}  ${x.kind}  ${x.detail}`),
  );
  console.log(`\n── 금지어 위반 ${kw.length}건 ──`);
  kw.forEach((k) => console.log("  " + k));

  // 카테고리별
  const byCat: Record<string, [number, number]> = {};
  for (const r of strictR) {
    const c = (byCat[r.f.category] ??= [0, 0]);
    c[1]++;
    if (r.fails.length === 0) c[0]++;
  }
  console.log("\n── 카테고리별 ──");
  for (const [c, [p, t]] of Object.entries(byCat))
    console.log(`  ${c.padEnd(16)} ${p}/${t}`);

  // boundary 분포
  const bd = results.filter((r) => r.f.mode === "boundary");
  if (bd.length) {
    console.log("\n── boundary (통과율 제외, 분포만) ──");
    bd.forEach((r) =>
      console.log(
        `  ${r.f.id}  → ${r.out.action}/${r.out.shift_confidence ?? "-"}`,
      ),
    );
  }

  // 오답 상세
  const bad = strictR.filter((r) => r.fails.length);
  if (bad.length) {
    console.log("\n── 오답 상세 ──");
    for (const r of bad) {
      console.log(`\n[${r.f.id}] ${r.f.category}`);
      r.fails.forEach((x) => console.log(`  ${x.kind}: ${x.detail}`));
      if (r.f.must_not.length) console.log(`  주의: ${r.f.must_not[0]}`);
    }
  }
}

// CLI
if (process.argv[1]?.endsWith("eval-core.mts")) {
  const dry = process.argv.includes("--dry");
  const idArg = process.argv.find((a) => a.startsWith("--id"));
  const ids = idArg
    ? (
        idArg.split("=")[1] ?? process.argv[process.argv.indexOf(idArg) + 1]
      ).split(",")
    : undefined;
  if (!dry) throw new Error("MODEL_RUNNER_NOT_CONFIGURED: use --dry");
  run("eval/judge.jsonl", null, ids).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
