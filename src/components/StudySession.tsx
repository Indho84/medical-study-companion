"use client";

import { useCallback, useEffect, useState } from "react";
import Markdown from "./Markdown";
import { previewInterval, review, type Grade } from "@/lib/srs";
import type { Flashcard, SrsState } from "@/lib/types";

export interface StudyItem {
  deckId: string;
  deckTitle?: string;
  card: Flashcard;
}

const GRADES: { grade: Grade; label: string; key: string }[] = [
  { grade: "again", label: "Again", key: "1" },
  { grade: "hard", label: "Hard", key: "2" },
  { grade: "good", label: "Good", key: "3" },
  { grade: "easy", label: "Easy", key: "4" },
];

export default function StudySession({
  items,
  onGrade,
  onDone,
}: {
  items: StudyItem[];
  onGrade: (deckId: string, cardId: string, srs: SrsState) => Promise<void> | void;
  onDone?: () => void;
}) {
  const [queue, setQueue] = useState(items);
  const [revealed, setRevealed] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const current = queue[0];

  const grade = useCallback(
    async (g: Grade) => {
      if (!current) return;
      const srs = review(current.card.srs, g);
      await onGrade(current.deckId, current.card.id, srs);
      const updated = { ...current, card: { ...current.card, srs } };
      // Failed cards go to the back of today's queue so you see them again.
      setQueue((q) => (g === "again" ? [...q.slice(1), updated] : q.slice(1)));
      setRevealed(false);
      setReviewed((n) => n + 1);
    },
    [current, onGrade],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
      if (!revealed && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        setRevealed(true);
      } else if (revealed) {
        const g = GRADES.find((x) => x.key === e.key);
        if (g) grade(g.grade);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [revealed, grade]);

  if (!current) {
    return (
      <div className="card stack" style={{ alignItems: "center", textAlign: "center" }}>
        <div style={{ fontSize: "2rem" }}>🎉</div>
        <strong>Session complete — {reviewed} reviews done.</strong>
        <div className="muted small">Cards will come back when they are due, based on how well you knew them.</div>
        {onDone && <button onClick={onDone}>Back</button>}
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="spread small muted">
        <span>
          {queue.length} left · {reviewed} reviewed
        </span>
        <span className="row" style={{ gap: 6 }}>
          {current.deckTitle && <span className="pill">{current.deckTitle}</span>}
          {current.card.tag && <span className="pill accent">{current.card.tag}</span>}
        </span>
      </div>
      <div className="card flashcard" onClick={() => setRevealed(true)}>
        <Markdown>{current.card.front}</Markdown>
        {revealed ? (
          <div className="back">
            <Markdown>{current.card.back}</Markdown>
          </div>
        ) : (
          <div className="muted small">Click or press Space to show the answer</div>
        )}
      </div>
      {revealed && (
        <div className="grade-row">
          {GRADES.map(({ grade: g, label, key }) => (
            <button key={g} className={g} onClick={() => grade(g)}>
              <strong>{label}</strong>
              <span className="small muted">
                {previewInterval(current.card.srs, g)} · [{key}]
              </span>
            </button>
          ))}
        </div>
      )}
      {onDone && (
        <div>
          <button className="ghost small" onClick={onDone}>
            ← End session
          </button>
        </div>
      )}
    </div>
  );
}
