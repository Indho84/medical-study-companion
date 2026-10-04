"use client";

import { useState } from "react";
import Generating from "./Generating";
import Markdown from "./Markdown";
import StudySession from "./StudySession";
import { isCancel, useAi } from "@/lib/ai";
import { newId } from "@/lib/db";
import { isDue, newSrs } from "@/lib/srs";
import type { Deck } from "@/lib/types";

export default function FlashcardsPanel({
  deck,
  update,
}: {
  deck: Deck;
  update: (fn: (d: Deck) => Deck) => Promise<void>;
}) {
  const { generate } = useAi();
  const [count, setCount] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<"due" | "all" | null>(null);
  const [showList, setShowList] = useState(false);

  const due = deck.flashcards.filter((c) => isDue(c));

  async function create() {
    setLoading(true);
    setError(null);
    try {
      const { cards } = await generate({
        kind: "flashcards",
        title: deck.title,
        text: deck.text,
        language: deck.language,
        count,
      });
      const now = Date.now();
      await update((d) => ({
        ...d,
        flashcards: [...d.flashcards, ...cards.map((c) => ({ ...c, id: newId(), srs: newSrs(now) }))],
      }));
    } catch (e) {
      if (!isCancel(e)) setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  function exportAnki() {
    // Tab-separated: front, back, tags — import into Anki with "Fields separated by: Tab".
    const clean = (s: string) => s.replace(/\t/g, " ").replace(/\r?\n/g, "<br>");
    const tag = deck.title.replace(/\s+/g, "_");
    const rows = deck.flashcards.map(
      (c) => `${clean(c.front)}\t${clean(c.back)}\t${tag} ${c.tag.replace(/\s+/g, "_")}`,
    );
    const blob = new Blob(["#separator:tab\n#html:true\n#tags column:3\n" + rows.join("\n")], {
      type: "text/plain",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${deck.title} - flashcards.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (session) {
    const items = (session === "due" ? due : deck.flashcards).map((card) => ({ deckId: deck.id, card }));
    return (
      <StudySession
        items={items}
        onGrade={(_, cardId, srs) =>
          update((d) => ({ ...d, flashcards: d.flashcards.map((c) => (c.id === cardId ? { ...c, srs } : c)) }))
        }
        onDone={() => setSession(null)}
      />
    );
  }

  return (
    <div className="stack">
      {deck.flashcards.length > 0 && (
        <div className="card spread">
          <div>
            <strong>
              {deck.flashcards.length} cards · {due.length} due now
            </strong>
            <div className="muted small">Spaced repetition: cards you find hard come back sooner.</div>
          </div>
          <div className="row">
            <button className="primary" disabled={!due.length} onClick={() => setSession("due")}>
              Study due ({due.length})
            </button>
            <button onClick={() => setSession("all")}>Cram all</button>
            <button onClick={exportAnki}>Export to Anki</button>
          </div>
        </div>
      )}

      {loading ? (
        <Generating what="flashcards" />
      ) : (
        <div className="card row">
          <label className="field">
            Number of cards
            <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
              {[10, 20, 30, 40, 50, 60].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <button className="primary" onClick={create} style={{ alignSelf: "flex-end" }}>
            {deck.flashcards.length ? "+ Generate more cards" : "Generate flashcards"}
          </button>
        </div>
      )}
      {error && <div className="error">{error}</div>}

      {deck.flashcards.length > 0 && (
        <div>
          <button className="ghost" onClick={() => setShowList(!showList)}>
            {showList ? "▾ Hide" : "▸ Show"} all cards
          </button>
          {showList && (
            <div className="stack" style={{ marginTop: 8 }}>
              {deck.flashcards.map((c) => (
                <div key={c.id} className="card" style={{ padding: 14 }}>
                  <div className="spread">
                    <span className="pill accent">{c.tag}</span>
                    <button
                      className="ghost danger small"
                      onClick={() => update((d) => ({ ...d, flashcards: d.flashcards.filter((x) => x.id !== c.id) }))}
                    >
                      Delete
                    </button>
                  </div>
                  <Markdown>{c.front}</Markdown>
                  <div className="muted">
                    <Markdown>{c.back}</Markdown>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
