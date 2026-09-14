import {
  rawThoughtSchema,
  startOutputSchema,
  nodeZeroOutputSchema,
  type NodeZeroOutput,
} from "../schemas/start.ts";
import { mapSafety } from "./safety.ts";

export type StartFlowResult =
  | { kind: "STOP" | "HANDOFF"; safety: ReturnType<typeof mapSafety> }
  | { kind: "NEEDS_INFO"; guidance: string }
  | { kind: "CLEAR_AS_IS"; question: string }
  | { kind: "FOCUS_REQUIRED"; question: string; candidates: string[] }
  | { kind: "PROPOSAL"; proposal: NodeZeroOutput };
type Dependencies = {
  /** Trusted server gate, including Moderation. Never accept a browser-supplied label. */
  safetyGate: (input: {
    context: string[];
    utterance: string;
  }) => Promise<unknown>;
  classify: (input: { raw_thought: string }) => Promise<unknown>;
  generate: (input: {
    raw_thought: string;
    selected_focus: string | null;
    focus_reply: string | null;
  }) => Promise<unknown>;
};

/** Ephemeral, single-draft coordinator. No DB/auth implementation and no cross-worker deduplication. */
export function createStartFlow(raw: unknown, deps: Dependencies) {
  const input = rawThoughtSchema.safeParse(raw);
  if (!input.success) throw new Error("START_INPUT_INVALID");
  const thought = input.data;
  let startPromise: Promise<StartFlowResult> | undefined;
  let focusPromise: Promise<StartFlowResult> | undefined;
  let chosenIndex: number | undefined;
  let candidates: string[] | undefined;
  async function gate(utterance: string, context: string[]) {
    const safety = mapSafety(await deps.safetyGate({ context, utterance }));
    return safety.behavior === "CONTINUE"
      ? null
      : ({ kind: safety.behavior, safety } as StartFlowResult);
  }
  async function generate(focus: string | null): Promise<StartFlowResult> {
    const value = await deps.generate({
      raw_thought: thought,
      selected_focus: focus,
      focus_reply: focus,
    });
    const parsed = nodeZeroOutputSchema.safeParse(value);
    if (
      !parsed.success ||
      parsed.data.evidence_quotes.some(
        (q) => !thought.includes(q) && !focus?.includes(q),
      ) ||
      new Set(parsed.data.evidence_quotes).size !==
        parsed.data.evidence_quotes.length
    )
      throw new Error("NODE_ZERO_OUTPUT_INVALID");
    return { kind: "PROPOSAL", proposal: parsed.data };
  }
  async function begin(): Promise<StartFlowResult> {
    const blocked = await gate(thought, []);
    if (blocked) return blocked;
    const result = startOutputSchema.safeParse(
      await deps.classify({ raw_thought: thought }),
    );
    if (
      !result.success ||
      result.data.focus_candidates.some((v) => !thought.includes(v))
    )
      throw new Error("START_OUTPUT_INVALID");
    const a = result.data;
    if (a.label === "NEEDS_INFO")
      return { kind: "NEEDS_INFO", guidance: a.info_guidance! };
    if (a.label === "CLEAR_AS_IS")
      return { kind: "CLEAR_AS_IS", question: thought };
    if (a.focus_required) {
      candidates = [...a.focus_candidates];
      return {
        kind: "FOCUS_REQUIRED",
        question: a.focus_question!,
        candidates: [...candidates],
      };
    }
    return generate(null);
  }
  // Failed operations stay failed: retries require an explicit new draft, never hidden model retries.
  async function safe(operation: () => Promise<StartFlowResult>) {
    try {
      return await operation();
    } catch {
      throw new Error("START_FLOW_FAILED");
    }
  }
  return {
    start(): Promise<StartFlowResult> {
      startPromise ??= safe(begin);
      return startPromise.then((value) => structuredClone(value));
    },
    /** Explicit user selection of a server-owned candidate. Free-form focus replies remain separate work. */
    selectFocus(index: number): Promise<StartFlowResult> {
      if (
        !Number.isInteger(index) ||
        !candidates ||
        index < 0 ||
        index >= candidates.length
      )
        return Promise.reject(new Error("START_FOCUS_INVALID"));
      if (chosenIndex !== undefined && chosenIndex !== index)
        return Promise.reject(new Error("START_FOCUS_ALREADY_SELECTED"));
      const focus = candidates[index];
      chosenIndex = index;
      focusPromise ??= safe(async () => {
        const blocked = await gate(focus, [thought]);
        return blocked ?? generate(focus);
      });
      return focusPromise.then((value) => structuredClone(value));
    },
  };
}
