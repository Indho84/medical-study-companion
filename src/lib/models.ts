/** Models the student can pick in Settings. Kept apart from the SDK so pages stay light. */
export const MODELS = {
  "claude-haiku-4-5": { label: "Claude Haiku 4.5 — cheaper (about 4× less)", short: "Haiku" },
  "claude-opus-5-5": { label: "Claude Opus 5.5 — best quality", short: "Opus" },
} as const;

export type ModelId = keyof typeof MODELS;
export const DEFAULT_BROWSER_MODEL: ModelId = "claude-haiku-4-5";
