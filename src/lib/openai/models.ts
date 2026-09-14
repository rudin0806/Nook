export const NOOK_MODEL_IDS = [
  "gpt-5.6-luna",
  "gpt-5.6-terra",
  "gpt-5.6-sol",
] as const;

export type NookModelId = (typeof NOOK_MODEL_IDS)[number];

export const NOOK_REASONING_EFFORTS = ["low", "medium", "high"] as const;

export type NookReasoningEffort = (typeof NOOK_REASONING_EFFORTS)[number];

export function isNookModelId(value: string): value is NookModelId {
  return (NOOK_MODEL_IDS as readonly string[]).includes(value);
}

export function requireNookModelId(value: string): NookModelId {
  if (!isNookModelId(value)) throw new Error("MODEL_NOT_ALLOWED");
  return value;
}

export function requireNookReasoningEffort(value: string): NookReasoningEffort {
  if (!(NOOK_REASONING_EFFORTS as readonly string[]).includes(value))
    throw new Error("REASONING_EFFORT_NOT_ALLOWED");
  return value as NookReasoningEffort;
}
