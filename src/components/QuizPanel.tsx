"use client";

import { useState } from "react";
import Generating from "./Generating";
import QuizRunner, { type QuizMode } from "./QuizRunner";
import { generate } from "@/lib/api";
import { newId } from "@/lib/db";
import { EXAM_FORMATS, LANGUAGE_LABELS, getExamFormat } from "@/lib/examFormats";
import type { Deck, ExamFormatId, Language, Quiz } from "@/lib/types";
import { weakTopics } from "@/lib/weakTopics";

export default function QuizPanel({
  deck,
  update,
}: {
  deck: Deck;
  update: (fn: (d: Deck) => Deck) => Promise<void>;
}) {
  const [formatId, setFormatId] = useState<ExamFormatId>("usmle");
  const [language, setLanguage] = useState<Language>(deck.language);
  const [count, setCount] = useState(10);
  const [mode, setMode] = useState<QuizMode>("tutor");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<Quiz | null>(null);

  const format = getExamFormat(formatId);
  const weak = weakTopics(deck);

  async function create(focusTopics?: string[]) {
    setLoading(true);
    setError(null);
    try {
      const { questions } = await generate({
        kind: "quiz",
        title: deck.title,
        text: deck.text,
        language,
        count,
        format: formatId,
        focusTopics,
      });
      if (!questions.length) throw new Error("No usable questions came back — please try again.");
      const quiz: Quiz = {
        id: newId(),
        format: formatId,
        language,
        createdAt: Date.now(),
        questions,
        attempts: [],
        ...(focusTopics?.length ? { focusTopics } : {}),
      };
      await update((d) => ({ ...d, quizzes: [quiz, ...d.quizzes] }));
      setActive(quiz);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  if (active) {
    return (
      <QuizRunner
        key={active.id + mode}
        quiz={active}
        mode={mode}
        onExit={() => setActive(null)}
        onFinish={async (score, total, topics) => {
          await update((d) => ({
            ...d,
            quizzes: d.quizzes.map((q) =>
              q.id === active.id ? { ...q, attempts: [...q.attempts, { finishedAt: Date.now(), score, total, topics }] } : q,
            ),
          }));
          setActive(null);
        }}
      />
    );
  }

  return (
    <div className="stack">
      <div className="card stack">
        <strong>Create a quiz</strong>
        <div className="row" style={{ alignItems: "flex-end" }}>
          <label className="field">
            Exam format
            <select
              value={formatId}
              onChange={(e) => {
                const id = e.target.value as ExamFormatId;
                setFormatId(id);
                setLanguage(id === "tus" ? "tr" : deck.language);
              }}
            >
              {EXAM_FORMATS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            {format.kind === "emq" ? "EMQ sets" : "Questions"}
            <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
              {(format.kind === "emq" ? [2, 3, 5, 8] : [5, 10, 20, 30, 40]).map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Language
            <select value={language} onChange={(e) => setLanguage(e.target.value as Language)}>
              {Object.entries(LANGUAGE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Mode
            <select value={mode} onChange={(e) => setMode(e.target.value as QuizMode)}>
              <option value="tutor">Tutor — explanation after each question</option>
              <option value="exam">Exam — timed, answers at the end</option>
            </select>
          </label>
        </div>
        <div className="muted small">{format.description}</div>
        {loading ? (
          <Generating what={`${format.short} quiz`} />
        ) : (
          <div>
            <button className="primary" onClick={() => create()}>
              Generate quiz
            </button>
          </div>
        )}
        {error && <div className="error">{error}</div>}
      </div>

      {weak.length > 0 && (
        <div className="card stack">
          <div className="spread">
            <div>
              <strong>🎯 Your weak topics</strong>
              <div className="muted small">From your quiz answers and flashcards you keep forgetting.</div>
            </div>
            <button
              className="primary"
              disabled={loading}
              onClick={() => create(weak.slice(0, 6).map((w) => w.topic))}
            >
              Practice weak topics ({format.short})
            </button>
          </div>
          <div className="stack" style={{ gap: 6 }}>
            {weak.slice(0, 8).map((w) => {
              const pct = w.total ? Math.round((w.correct / w.total) * 100) : null;
              return (
                <div key={w.topic} className="weak-row">
                  <span>{w.topic}</span>
                  <span className="meter" aria-hidden>
                    <span style={{ width: `${pct ?? 0}%` }} />
                  </span>
                  <span className="small muted">
                    {pct !== null ? `${pct}% (${w.correct}/${w.total})` : "—"}
                    {w.lapses ? ` · ${w.lapses} forgotten card${w.lapses > 1 ? "s" : ""}` : ""}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {deck.quizzes.length > 0 && (
        <>
          <h2>Your quizzes</h2>
          <div className="stack" style={{ gap: 8 }}>
            {deck.quizzes.map((quiz) => {
              const f = getExamFormat(quiz.format);
              const last = quiz.attempts.at(-1);
              return (
                <div key={quiz.id} className="card spread" style={{ padding: 14 }}>
                  <div>
                    <strong>{f.label}</strong> {quiz.focusTopics && <span className="pill accent">🎯 weak topics</span>}{" "}
                    <span className="muted small">
                      · {quiz.questions.length} {f.kind === "emq" ? "sets" : "questions"} ·{" "}
                      {LANGUAGE_LABELS[quiz.language]} · {new Date(quiz.createdAt).toLocaleDateString()}
                    </span>
                    {last && (
                      <div className="small">
                        Last score:{" "}
                        <span className={`pill ${last.score / last.total >= 0.6 ? "good" : "bad"}`}>
                          {last.score}/{last.total} ({Math.round((last.score / last.total) * 100)}%)
                        </span>{" "}
                        <span className="muted">· {quiz.attempts.length} attempt(s)</span>
                      </div>
                    )}
                  </div>
                  <div className="row">
                    <button className="primary" onClick={() => setActive(quiz)}>
                      {quiz.attempts.length ? "Retake" : "Start"} ({mode})
                    </button>
                    <button
                      className="ghost danger small"
                      onClick={() =>
                        confirm("Delete this quiz?") &&
                        update((d) => ({ ...d, quizzes: d.quizzes.filter((q) => q.id !== quiz.id) }))
                      }
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
