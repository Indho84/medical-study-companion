import type { Deck } from "./types";

export interface TopicStat {
  topic: string;
  correct: number;
  total: number;
  /** Times flashcards with this tag were forgotten after being learned. */
  lapses: number;
}

const WEAK_ACCURACY = 0.7;
const MIN_POINTS = 2;
const MIN_LAPSES = 2;

const norm = (t: string) => t.trim().toLowerCase();

/**
 * Combine quiz results (per topic) and flashcard lapses (per tag) into a list of
 * weak topics, weakest first.
 */
export function weakTopics(deck: Deck): TopicStat[] {
  const stats = new Map<string, TopicStat>();
  const entry = (topic: string) => {
    const key = norm(topic);
    let s = stats.get(key);
    if (!s) stats.set(key, (s = { topic: topic.trim(), correct: 0, total: 0, lapses: 0 }));
    return s;
  };

  for (const quiz of deck.quizzes) {
    for (const attempt of quiz.attempts) {
      for (const [topic, r] of Object.entries(attempt.topics ?? {})) {
        const s = entry(topic);
        s.correct += r.correct;
        s.total += r.total;
      }
    }
  }
  for (const card of deck.flashcards) {
    if (card.tag && card.srs.lapses) entry(card.tag).lapses += card.srs.lapses;
  }

  return [...stats.values()]
    .filter(
      (s) => (s.total >= MIN_POINTS && s.correct / s.total < WEAK_ACCURACY) || s.lapses >= MIN_LAPSES,
    )
    .sort((a, b) => score(a) - score(b));
}

/** Lower is weaker: quiz accuracy, pulled down by forgotten flashcards. */
function score(s: TopicStat): number {
  const accuracy = s.total ? s.correct / s.total : 1;
  return accuracy - 0.1 * s.lapses;
}
