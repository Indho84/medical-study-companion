"use client";

import { DEFAULT_BROWSER_MODEL, MODELS, type ModelId } from "./models";

export interface Settings {
  /** The student's own Anthropic API key. Stored only in this browser. */
  apiKey: string;
  model: ModelId;
}

const KEY = "msc-settings";

export const DEFAULT_SETTINGS: Settings = { apiKey: "", model: DEFAULT_BROWSER_MODEL };

export function loadSettings(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return {
      apiKey: typeof raw.apiKey === "string" ? raw.apiKey : "",
      model: raw.model in MODELS ? raw.model : DEFAULT_BROWSER_MODEL,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: Settings): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}
