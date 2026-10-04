"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import FlashcardsPanel from "@/components/FlashcardsPanel";
import Generating from "@/components/Generating";
import Markdown from "@/components/Markdown";
import MindMap from "@/components/MindMap";
import QuizPanel from "@/components/QuizPanel";
import { generate } from "@/lib/api";
import { getDeck, saveDeck } from "@/lib/db";
import { LANGUAGE_LABELS } from "@/lib/examFormats";
import type { Deck, Language } from "@/lib/types";

type Tab = "notes" | "mindmap" | "flashcards" | "quiz" | "slides";

const TABS: { id: Tab; label: string }[] = [
  { id: "notes", label: "📝 Spot notes" },
  { id: "mindmap", label: "🧠 Mind map" },
  { id: "flashcards", label: "🗂 Flashcards" },
  { id: "quiz", label: "✅ Quiz" },
  { id: "slides", label: "📄 Slide text" },
];

export default function DeckPage() {
  const { id } = useParams<{ id: string }>();
  const [deck, setDeck] = useState<Deck | null | undefined>(undefined);
  const deckRef = useRef<Deck | null>(null);
  const [tab, setTab] = useState<Tab>("notes");

  useEffect(() => {
    getDeck(id).then((d) => {
      deckRef.current = d ?? null;
      setDeck(d ?? null);
    });
  }, [id]);

  // Always apply updates to the latest saved deck so concurrent updates don't clobber each other.
  const update = useCallback(async (fn: (d: Deck) => Deck) => {
    if (!deckRef.current) return;
    const next = fn(deckRef.current);
    deckRef.current = next;
    setDeck(next);
    await saveDeck(next);
  }, []);

  if (deck === undefined) return <span className="spinner" />;
  if (deck === null)
    return (
      <p>
        Lecture not found. <Link href="/">Back to library</Link>
      </p>
    );

  return (
    <div>
      <Link href="/" className="small no-print">
        ← Library
      </Link>
      <div className="spread">
        <h1
          contentEditable
          suppressContentEditableWarning
          onBlur={(e) => {
            const title = e.currentTarget.textContent?.trim();
            if (title && title !== deck.title) update((d) => ({ ...d, title }));
          }}
          title="Click to rename"
        >
          {deck.title}
        </h1>
        <label className="row small muted no-print">
          Language
          <select
            value={deck.language}
            onChange={(e) => update((d) => ({ ...d, language: e.target.value as Language }))}
          >
            {Object.entries(LANGUAGE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="muted small">
        {deck.fileName} · {deck.slideCount} slides
      </div>

      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`tab ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "notes" && (
        <MarkdownTab
          deck={deck}
          update={update}
          kind="notes"
          what="spot notes"
          intro="Concise, high-yield revision notes with tables, buzzwords, mnemonics and common exam traps."
          render={(md) => (
            <div className="card">
              <Markdown>{md}</Markdown>
            </div>
          )}
          extraActions={<button onClick={() => window.print()}>🖨 Print / save PDF</button>}
        />
      )}
      {tab === "mindmap" && (
        <MarkdownTab
          deck={deck}
          update={update}
          kind="mindmap"
          what="mind map"
          intro="An interactive mind map of the lecture structure — zoom, pan and fold branches."
          render={(md) => <MindMap markdown={md} />}
        />
      )}
      {tab === "flashcards" && <FlashcardsPanel deck={deck} update={update} />}
      {tab === "quiz" && <QuizPanel deck={deck} update={update} />}
      {tab === "slides" && (
        <div className="stack">
          <p className="muted small">
            This is the text extracted from your file — it is what Claude reads. Images and diagrams without text
            are not included.
          </p>
          <pre className="slidetext">{deck.text}</pre>
        </div>
      )}
    </div>
  );
}

function MarkdownTab({
  deck,
  update,
  kind,
  what,
  intro,
  render,
  extraActions,
}: {
  deck: Deck;
  update: (fn: (d: Deck) => Deck) => Promise<void>;
  kind: "notes" | "mindmap";
  what: string;
  intro: string;
  render: (markdown: string) => React.ReactNode;
  extraActions?: React.ReactNode;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const content = deck[kind];

  async function create() {
    if (content && !confirm(`Replace the current ${what}?`)) return;
    setLoading(true);
    setError(null);
    try {
      const { markdown } = await generate({ kind, title: deck.title, text: deck.text, language: deck.language });
      await update((d) => ({ ...d, [kind]: markdown }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="stack">
      {loading ? (
        <Generating what={what} />
      ) : content ? (
        <div className="row no-print">
          <button onClick={create}>↻ Regenerate</button>
          {extraActions}
        </div>
      ) : (
        <div className="card stack" style={{ alignItems: "flex-start" }}>
          <div className="muted">{intro}</div>
          <button className="primary" onClick={create}>
            Generate {what}
          </button>
        </div>
      )}
      {error && <div className="error">{error}</div>}
      {content && render(content)}
    </div>
  );
}
