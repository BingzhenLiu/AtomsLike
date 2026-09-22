/**
 * Atoms AIHub models used by each stage. Every AI step in this product names one
 * supported model explicitly; swapping a model only requires changing this map.
 */
export const AI_MODELS = {
  plan: "gpt-5.5",
  design: "gpt-5.5",
  engineer: "claude-opus-5",
  review: "gpt-5.5",
  repair: "gpt-5.4",
} as const;

export type AiStageModel = (typeof AI_MODELS)[keyof typeof AI_MODELS];

export const AI_STAGE_TIMEOUT_MS = {
  plan: 120_000,
  design: 120_000,
  engineer: 300_000,
  review: 120_000,
} as const;
