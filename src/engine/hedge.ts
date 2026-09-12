/**
 * 완화형 판정 (RULES 3.3 / 3.5)
 *
 * 사용자가 스스로 확신하지 못하는 것을 AI가 확정해서 지도에 올리면 안 된다.
 * 다만 말끝을 흐리는 것은 한국어에서 흔한 화법 습관이라,
 * 그 사람의 세션이 통째로 비는 것을 막기 위해 hedge_ratio로 보정한다.
 *
 * 코드가 세고 LLM은 플래그를 받아 판단만 한다.
 */

export type Turn = { id: string; role: "user" | "assistant"; text: string };

/** RULES 3.5 — 값을 바꾸면 fixture의 expected_hedge_speaker가 깨진다 */
export const HEDGE_THRESHOLD = 0.7;
export const HEDGE_MIN_TURNS = 5;

/** 문장 끝 정리 — 종결 부호, 이모지, 웃음, 공백 제거 */
function normalizeTail(text: string): string {
  return text
    .normalize("NFC")
    .replace(/[\s]+$/g, "")
    .replace(/[.!?。！？~…♡♥❤🥲🥹😅😂ㅋㅎㅜㅠ]+$/g, "")
    .replace(/[\s]+$/g, "");
}

/**
 * 한 발화를 문장 단위로 쪼개 마지막 문장만 본다.
 * "주문 몰릴 때. 근데 그만두면 할 게 없어질 것 같기도 해"
 * → 발화 전체의 확신 수준은 마지막 절이 결정한다.
 */
function lastSentence(text: string): string {
  const parts = text
    .split(/[.!?]\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts[parts.length - 1] : text.trim();
}

/**
 * 완화형 어미. 긴 패턴을 앞에 둔다 — "것 같기도 해"가 "것 같아"보다 먼저 잡혀야 한다.
 *
 * 원칙: 화자가 자기 판단의 확신을 낮추는 표현만 넣는다.
 * - 단순 의문형("~까?")은 넣지 않는다. 질문은 확신과 무관하다.
 * - 걱정·예상("갈까 봐")도 넣지 않는다. 확신을 낮추는 게 아니다.
 * - 단정적 반복("모르겠다니까")도 넣지 않는다. 어조가 단정적이다.
 */
export const HEDGE_PATTERNS: { name: string; re: RegExp }[] = [
  { name: "것같기도", re: /것\s*같기도\s*(하?[고다여]?|해|했?어|하네)$/ },
  {
    name: "것같-",
    re: /것\s*같(아|긴\s*해|은데|기도|네|다|아서|아요|습니다)?$/,
  },
  { name: "거같-", re: /거\s*같(아|긴\s*해|은데|네|다)?$/ },
  { name: "건가싶", re: /(인|한|일|할)?\s*(건|건가|건지)\s*싶(어|다|네|고)?$/ },
  { name: "싶기도", re: /싶기도\s*(하?[고다]?|해|했?어)$/ },
  { name: "나싶", re: /(나|까)\s*싶(어|다|네|고|어서)?$/ },
  { name: "ㄹ까싶", re: /(려나|을까\s*싶|ㄹ까\s*싶)/ },
  { name: "가봐", re: /[가나]\s*[봐바](요)?$/ },
  { name: "인가봐", re: /(인가|는가|을까|ㄴ가)\s*[봐바](요)?$/ },
  { name: "듯", re: /(듯|듯\s*해|듯\s*하다|듯\s*싶)$/ },
  { name: "그런듯", re: /그런\s*듯$/ },
  { name: "모르겠", re: /모르겠(어|다|네|어요|습니다)?$/ },
  { name: "잘모르", re: /잘\s*모르(겠)?/ },
  { name: "글쎄", re: /글쎄/ },
  { name: "아마", re: /아마/ },
  { name: "어쩌면", re: /어쩌면/ },
  { name: "혹시", re: /혹시/ },
  { name: "편", re: /(은|는)\s*편(이야|이에요|인\s*것\s*같아)?$/ },
];

/** 발화가 완화형으로 끝나는가. 걸린 패턴 이름도 함께 반환한다 */
export function matchHedge(text: string): string | null {
  const tail = normalizeTail(lastSentence(text));
  if (!tail) return null;
  const hit = HEDGE_PATTERNS.find((p) => p.re.test(tail));
  return hit ? hit.name : null;
}

export function isHedged(text: string): boolean {
  return matchHedge(text) !== null;
}

export type HedgeResult = {
  userTurnCount: number;
  hedgedCount: number;
  ratio: number;
  hedgeSpeaker: boolean;
  threshold: number;
  minTurns: number;
  /** 디버깅용 — 어느 발화가 어떤 패턴에 걸렸는지 */
  hits: { id: string; pattern: string }[];
};

/**
 * hedge_ratio 계산 (RULES 3.5)
 *
 * 임계 0.7, 최소 표본 5턴. 5턴 미만에서는 표본이 부족해 적용하지 않는다.
 * history와 현재 창을 합쳐서 센다 — 화법 습관은 세션 전체의 성질이다.
 */
export function computeHedge(
  turns: readonly Turn[],
  opts: { threshold?: number; minTurns?: number } = {},
): HedgeResult {
  const threshold = opts.threshold ?? HEDGE_THRESHOLD;
  const minTurns = opts.minTurns ?? HEDGE_MIN_TURNS;

  if (new Set(turns.map((t) => t.id)).size !== turns.length)
    throw new Error("DUPLICATE_TURN_ID");
  const userTurns = turns.filter((t) => t.role === "user");
  const hits: { id: string; pattern: string }[] = [];
  for (const t of userTurns) {
    const p = matchHedge(t.text);
    if (p) hits.push({ id: t.id, pattern: p });
  }
  const ratio = userTurns.length ? hits.length / userTurns.length : 0;

  return {
    userTurnCount: userTurns.length,
    hedgedCount: hits.length,
    ratio,
    hedgeSpeaker: userTurns.length >= minTurns && ratio >= threshold,
    threshold,
    minTurns,
    hits,
  };
}

export type HedgeTurn = Turn;
export const hasHedgeEnding = isHedged;
export function calculateHedgeStats(turns: readonly Turn[]) {
  const h = computeHedge(turns);
  return {
    userTurnCount: h.userTurnCount,
    hedgedTurnCount: h.hedgedCount,
    hedgeRatio: h.ratio,
    hedgeSpeaker: h.hedgeSpeaker,
  };
}
