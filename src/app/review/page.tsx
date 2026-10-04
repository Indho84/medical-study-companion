"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import StudySession, { type StudyItem } from "@/components/StudySession";
import { getDeck, listDecks, saveDeck } from "@/lib/db";
import { isDue } from "@/lib/srs";
import type { SrsState } from "@/lib/types";

/** Review every due flashcard across all lectures in one session. */
export default function ReviewPage() {
  const [items, setItems] = useState<StudyItem[] | null>(null);

  useEffect(() => {
    listDecks().then((decks) => {
      const due = decks.flatMap((d) =>
        d.flashcards.filter((c) => isDue(c)).map((card) => ({ deckId: d.id, deckTitle: d.title, card })),
      );
      // Interleave topics: mixing lectures improves retention versus blocked practice.
      due.sort(() => Math.random() - 0.5);
      setItems(due);
    });
  }, []);

  async function onGrade(deckId: string, cardId: string, srs: SrsState) {
    const deck = await getDeck(deckId);
    if (!deck) return;
    await saveDeck({ ...deck, flashcards: deck.flashcards.map((c) => (c.id === cardId ? { ...c, srs } : c)) });
  }

  if (items === null) return <span className="spinner" />;

  return (
    <div className="stack">
      <h1>Review due cards</h1>
      {items.length === 0 ? (
        <p className="muted">
          Nothing due right now. <Link href="/">Generate flashcards</Link> from a lecture, or come back later.
        </p>
      ) : (
        <StudySession items={items} onGrade={onGrade} />
      )}
    </div>
  );
}
