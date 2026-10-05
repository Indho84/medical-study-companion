"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { deleteDeck, listCases, listDecks, newId, saveCase, saveDeck } from "@/lib/db";
import { LANGUAGE_LABELS } from "@/lib/examFormats";
import { ACCEPTED_FILES, extractSlides } from "@/lib/extract";
import { isDue } from "@/lib/srs";
import type { CaseReport, Deck, Language } from "@/lib/types";

export default function LibraryPage() {
  const [decks, setDecks] = useState<Deck[] | null>(null);
  const [language, setLanguage] = useState<Language>("en");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const importInput = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => listDecks().then(setDecks), []);
  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleFiles(files: FileList | File[]) {
    setError(null);
    for (const file of Array.from(files)) {
      setBusy(`Reading ${file.name}…`);
      try {
        const { text, slideCount } = await extractSlides(file);
        if (text.replace(/--- Slide \d+ ---/g, "").trim().length < 50) {
          throw new Error(
            `${file.name}: almost no text found. It may be scanned images — export the slides with selectable text, or paste the text instead.`,
          );
        }
        await saveDeck({
          id: newId(),
          title: file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "),
          fileName: file.name,
          createdAt: Date.now(),
          text,
          slideCount,
          language,
          flashcards: [],
          quizzes: [],
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    }
    setBusy(null);
    refresh();
  }

  async function exportBackup() {
    const [all, cases] = await Promise.all([listDecks(), listCases()]);
    const blob = new Blob([JSON.stringify({ version: 1, decks: all, cases })], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `study-companion-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importBackup(file: File) {
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.decks)) throw new Error("Not a Study Companion backup file.");
      for (const deck of data.decks as Deck[]) await saveDeck(deck);
      for (const c of (data.cases ?? []) as CaseReport[]) await saveCase(c);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function remove(deck: Deck) {
    if (!confirm(`Delete "${deck.title}" and all its notes, cards and quizzes?`)) return;
    await deleteDeck(deck.id);
    refresh();
  }

  const totalDue = decks?.reduce((n, d) => n + d.flashcards.filter((c) => isDue(c)).length, 0) ?? 0;

  return (
    <div className="stack">
      <div>
        <h1>Your lecture library</h1>
        <p className="muted">
          Upload lecture slides (PDF or PowerPoint) and turn them into spot notes, mind maps, spaced-repetition
          flashcards and USMLE / PLAB / TUS / AMC or school-style quizzes.
        </p>
      </div>

      <div
        className={`dropzone ${dragging ? "active" : ""}`}
        onClick={() => fileInput.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
      >
        <input
          ref={fileInput}
          type="file"
          accept={ACCEPTED_FILES}
          multiple
          hidden
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
        {busy ? (
          <div className="row" style={{ justifyContent: "center" }}>
            <span className="spinner" /> {busy}
          </div>
        ) : (
          <>
            <div style={{ fontSize: "2rem" }} aria-hidden>
              📄
            </div>
            <strong>Drop slides here or click to upload</strong>
            <div className="muted small">PDF, PPTX or TXT · multiple files at once · processed on your device</div>
          </>
        )}
      </div>

      <div className="spread">
        <label className="row small muted">
          Output language for new uploads
          <select value={language} onChange={(e) => setLanguage(e.target.value as Language)}>
            {Object.entries(LANGUAGE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <div className="row">
          <button onClick={exportBackup} disabled={!decks?.length}>
            ⬇ Backup
          </button>
          <button onClick={() => importInput.current?.click()}>⬆ Restore</button>
          <input
            ref={importInput}
            type="file"
            accept=".json"
            hidden
            onChange={(e) => e.target.files?.[0] && importBackup(e.target.files[0])}
          />
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      {totalDue > 0 && (
        <div className="card spread">
          <div>
            <strong>{totalDue} flashcards due</strong>
            <div className="muted small">across all your lectures</div>
          </div>
          <Link href="/review" className="btn primary">
            Start review
          </Link>
        </div>
      )}

      <h2>Lectures</h2>
      {decks === null ? (
        <span className="spinner" />
      ) : decks.length === 0 ? (
        <p className="muted">No lectures yet — upload your first slides above.</p>
      ) : (
        <div className="grid">
          {decks.map((deck) => {
            const due = deck.flashcards.filter((c) => isDue(c)).length;
            return (
              <div key={deck.id} className="card stack" style={{ gap: 8 }}>
                <Link href={`/deck?id=${deck.id}`} style={{ fontWeight: 600, fontSize: "1.05rem" }}>
                  {deck.title}
                </Link>
                <div className="muted small">
                  {deck.slideCount} slides · {new Date(deck.createdAt).toLocaleDateString()}
                </div>
                <div className="row" style={{ gap: 6 }}>
                  {deck.notes && <span className="pill accent">Notes</span>}
                  {deck.mindmap && <span className="pill accent">Mind map</span>}
                  {deck.flashcards.length > 0 && (
                    <span className="pill accent">
                      {deck.flashcards.length} cards{due ? ` · ${due} due` : ""}
                    </span>
                  )}
                  {deck.quizzes.length > 0 && <span className="pill accent">{deck.quizzes.length} quizzes</span>}
                </div>
                <div className="spread">
                  <Link href={`/deck?id=${deck.id}`} className="btn primary">
                    Open
                  </Link>
                  <button className="ghost danger small" onClick={() => remove(deck)}>
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
