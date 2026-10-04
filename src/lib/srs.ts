import type { Flashcard, SrsState } from "./types";

/** Spaced repetition based on SM-2 (the algorithm behind Anki), with Anki-style buttons. */

export type Grade = "again" | "hard" | "good" | "easy";

const DAY = 24 * 60 * 60 * 1000;
const RELEARN_DELAY = 10 * 60 * 1000; // a failed card comes back in 10 minutes

export function newSrs(now = Date.now()): SrsState {
  return { ease: 2.5, interval: 0, reps: 0, lapses: 0, due: now };
}

export function review(state: SrsState, grade: Grade, now = Date.now()): SrsState {
  if (grade === "again") {
    return {
      ease: Math.max(1.3, state.ease - 0.2),
      interval: 0,
      reps: 0,
      lapses: state.lapses + (state.reps > 0 ? 1 : 0),
      due: now + RELEARN_DELAY,
    };
  }

  const q = grade === "hard" ? 3 : grade === "good" ? 4 : 5;
  const ease = Math.max(1.3, state.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  const reps = state.reps + 1;

  let interval: number;
  if (reps === 1) interval = grade === "easy" ? 4 : 1;
  else if (reps === 2) interval = grade === "hard" ? 3 : grade === "good" ? 6 : 8;
  else {
    const factor = grade === "hard" ? 1.2 : grade === "good" ? ease : ease * 1.3;
    interval = Math.max(state.interval + 1, Math.round(state.interval * factor));
  }

  return { ease, interval, reps, lapses: state.lapses, due: now + interval * DAY };
}

/** Human-readable preview of the next interval for a button label. */
export function previewInterval(state: SrsState, grade: Grade): string {
  const next = review(state, grade, 0);
  if (next.due < DAY) return "10 min";
  return next.interval === 1 ? "1 day" : `${next.interval} days`;
}

export function isDue(card: Flashcard, now = Date.now()): boolean {
  return card.srs.due <= now;
}
