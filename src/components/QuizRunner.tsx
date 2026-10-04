"use client";

import { useEffect, useMemo, useState } from "react";
import Markdown from "./Markdown";
import { getExamFormat } from "@/lib/examFormats";
import type { Question, Quiz, TopicResult } from "@/lib/types";

export type QuizMode = "tutor" | "exam";

type Answer =
  | { type: "sba"; choice: number | null }
  | { type: "emq"; choices: (number | null)[] }
  | { type: "mtf"; choices: (boolean | null)[] }
  | { type: "saq"; text: string; marks: boolean[] };

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function emptyAnswer(q: Question): Answer {
  switch (q.type) {
    case "sba":
      return { type: "sba", choice: null };
    case "emq":
      return { type: "emq", choices: q.items.map(() => null) };
    case "mtf":
      return { type: "mtf", choices: q.statements.map(() => null) };
    case "saq":
      return { type: "saq", text: "", marks: q.markingPoints.map(() => false) };
  }
}

function maxPoints(q: Question): number {
  switch (q.type) {
    case "sba":
      return 1;
    case "emq":
      return q.items.length;
    case "mtf":
      return q.statements.length;
    case "saq":
      return q.markingPoints.length;
  }
}

function points(q: Question, a: Answer): number {
  if (q.type === "sba" && a.type === "sba") return a.choice === q.answerIndex ? 1 : 0;
  if (q.type === "emq" && a.type === "emq") return q.items.filter((it, i) => a.choices[i] === it.answerIndex).length;
  if (q.type === "mtf" && a.type === "mtf") return q.statements.filter((s, i) => a.choices[i] === s.answer).length;
  if (q.type === "saq" && a.type === "saq") return a.marks.filter(Boolean).length;
  return 0;
}

function isAnswered(a: Answer): boolean {
  switch (a.type) {
    case "sba":
      return a.choice !== null;
    case "emq":
      return a.choices.every((c) => c !== null);
    case "mtf":
      return a.choices.every((c) => c !== null);
    case "saq":
      return a.text.trim().length > 0;
  }
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export default function QuizRunner({
  quiz,
  mode,
  onFinish,
  onExit,
}: {
  quiz: Quiz;
  mode: QuizMode;
  onFinish: (score: number, total: number, topics: Record<string, TopicResult>) => void;
  onExit: () => void;
}) {
  const format = getExamFormat(quiz.format);
  const questions = quiz.questions;
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>(() => questions.map(emptyAnswer));
  const [revealed, setRevealed] = useState<boolean[]>(() => questions.map(() => false));
  const [finished, setFinished] = useState(false);
  const [flagged, setFlagged] = useState<boolean[]>(() => questions.map(() => false));

  const totalSeconds = useMemo(
    () => questions.reduce((s, q) => s + (q.type === "emq" ? q.items.length : 1), 0) * format.secondsPerQuestion,
    [questions, format.secondsPerQuestion],
  );
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds);

  const q = questions[index];
  const a = answers[index];
  const shown = finished || revealed[index];
  const total = questions.reduce((s, x) => s + maxPoints(x), 0);
  const score = questions.reduce((s, x, i) => s + points(x, answers[i]), 0);

  function finish() {
    setFinished(true);
    setRevealed(questions.map(() => true));
    setIndex(0);
  }

  // Exam-mode countdown; the exam ends automatically when time runs out.
  useEffect(() => {
    if (mode !== "exam" || finished) return;
    if (secondsLeft <= 0) {
      finish();
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, finished, secondsLeft]);

  function update(next: Answer) {
    setAnswers((prev) => prev.map((x, i) => (i === index ? next : x)));
  }

  function reveal() {
    setRevealed((prev) => prev.map((x, i) => (i === index ? true : x)));
  }

  const allRevealed = revealed.every(Boolean);

  function navClass(i: number) {
    const cls = [i === index ? "current" : ""];
    if (finished || (mode === "tutor" && revealed[i])) {
      const qi = questions[i];
      // SAQs are self-marked, so only colour them once marks exist.
      const p = points(qi, answers[i]);
      cls.push(p === maxPoints(qi) ? "correct" : p === 0 && qi.type !== "saq" ? "wrong" : "answered");
    } else if (isAnswered(answers[i])) cls.push("answered");
    return cls.join(" ");
  }

  return (
    <div className="stack">
      <div className="card spread">
        <div>
          <strong>{format.label}</strong>{" "}
          <span className="muted small">
            · {mode === "exam" ? "Exam mode" : "Tutor mode"} · Question {index + 1} of {questions.length}
          </span>
        </div>
        <div className="row">
          {mode === "exam" && !finished && (
            <span className={`timer ${secondsLeft < 60 ? "low" : ""}`}>⏱ {formatTime(secondsLeft)}</span>
          )}
          {(finished || (mode === "tutor" && allRevealed)) && (
            <span className="pill good">
              Score {score}/{total} ({total ? Math.round((score / total) * 100) : 0}%)
            </span>
          )}
        </div>
      </div>

      <div className="qnav">
        {questions.map((_, i) => (
          <button key={i} className={navClass(i)} onClick={() => setIndex(i)} title={flagged[i] ? "Flagged" : undefined}>
            {flagged[i] ? "⚑" : i + 1}
          </button>
        ))}
      </div>

      <div className="card stack">
        {q.topic && (
          <div>
            <span className="pill">{q.topic}</span>
          </div>
        )}
        <QuestionBody q={q} a={a} shown={shown} update={update} />
      </div>

      <div className="spread">
        <div className="row">
          <button disabled={index === 0} onClick={() => setIndex(index - 1)}>
            ← Previous
          </button>
          <button disabled={index === questions.length - 1} onClick={() => setIndex(index + 1)}>
            Next →
          </button>
          {!finished && (
            <button
              className="ghost"
              onClick={() => setFlagged((f) => f.map((x, i) => (i === index ? !x : x)))}
            >
              {flagged[index] ? "Unflag" : "⚑ Flag"}
            </button>
          )}
        </div>
        <div className="row">
          {mode === "tutor" && !shown && (
            <button className="primary" disabled={!isAnswered(a) && q.type !== "saq"} onClick={reveal}>
              {q.type === "saq" ? "Show model answer" : "Check answer"}
            </button>
          )}
          {!finished && (mode === "exam" || allRevealed) && (
            <button
              className="primary"
              onClick={() => {
                const unanswered = answers.filter((x) => !isAnswered(x)).length;
                if (mode === "exam" && unanswered && !confirm(`${unanswered} question(s) unanswered. Finish anyway?`))
                  return;
                finish();
              }}
            >
              Finish {mode === "exam" ? "exam" : "quiz"}
            </button>
          )}
          {finished && (
            <>
              <button
                className="primary"
                onClick={() => {
                  const topics: Record<string, TopicResult> = {};
                  questions.forEach((x, i) => {
                    const key = x.topic?.trim() || "General";
                    const t = (topics[key] ??= { correct: 0, total: 0 });
                    t.correct += points(x, answers[i]);
                    t.total += maxPoints(x);
                  });
                  onFinish(score, total, topics);
                }}
              >
                Save result & close
              </button>
            </>
          )}
          {!finished && (
            <button className="ghost" onClick={onExit}>
              Exit
            </button>
          )}
        </div>
      </div>
      {finished && questions.some((x) => x.type === "saq") && (
        <p className="muted small">Tick the marking points you covered on each SAQ — your score updates as you mark.</p>
      )}
    </div>
  );
}

function QuestionBody({
  q,
  a,
  shown,
  update,
}: {
  q: Question;
  a: Answer;
  shown: boolean;
  update: (a: Answer) => void;
}) {
  if (q.type === "sba" && a.type === "sba") {
    return (
      <>
        <Markdown>{q.stem}</Markdown>
        <strong>
          <Markdown>{q.leadIn}</Markdown>
        </strong>
        <div className="stack" style={{ gap: 8 }}>
          {q.options.map((opt, i) => {
            let cls = "option";
            if (shown && i === q.answerIndex) cls += " correct";
            else if (shown && i === a.choice) cls += " wrong";
            else if (i === a.choice) cls += " selected";
            return (
              <button key={i} className={cls} disabled={shown} onClick={() => update({ type: "sba", choice: i })}>
                <span className="letter">{LETTERS[i]}.</span>
                <span>
                  {opt}
                  {shown && q.optionExplanations[i] && (
                    <span className="muted small" style={{ display: "block" }}>
                      {q.optionExplanations[i]}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
        {shown && (
          <div className="explanation">
            <strong>
              Answer: {LETTERS[q.answerIndex]} — {a.choice === q.answerIndex ? "✅ correct" : "❌ incorrect"}
            </strong>
            <Markdown>{q.explanation}</Markdown>
          </div>
        )}
      </>
    );
  }

  if (q.type === "emq" && a.type === "emq") {
    return (
      <>
        <h3 style={{ margin: 0 }}>Theme: {q.theme}</h3>
        <ol type="A" style={{ columns: q.options.length > 6 ? 2 : 1, margin: 0 }}>
          {q.options.map((o, i) => (
            <li key={i}>{o}</li>
          ))}
        </ol>
        <em>{q.leadIn}</em>
        {q.items.map((item, i) => {
          const choice = a.choices[i];
          const correct = choice === item.answerIndex;
          return (
            <div key={i} className="stack" style={{ gap: 6 }}>
              <div>
                <strong>{i + 1}.</strong> {item.stem}
              </div>
              <select
                value={choice ?? ""}
                disabled={shown}
                onChange={(e) =>
                  update({
                    type: "emq",
                    choices: a.choices.map((c, j) => (j === i ? Number(e.target.value) : c)),
                  })
                }
                style={{ maxWidth: 420 }}
              >
                <option value="" disabled>
                  Choose an option…
                </option>
                {q.options.map((o, j) => (
                  <option key={j} value={j}>
                    {LETTERS[j]}. {o}
                  </option>
                ))}
              </select>
              {shown && (
                <div className="explanation small">
                  <strong>
                    {correct ? "✅" : "❌"} Answer: {LETTERS[item.answerIndex]}. {q.options[item.answerIndex]}
                  </strong>
                  <Markdown>{item.explanation}</Markdown>
                </div>
              )}
            </div>
          );
        })}
      </>
    );
  }

  if (q.type === "mtf" && a.type === "mtf") {
    return (
      <>
        <Markdown>{q.stem}</Markdown>
        {q.statements.map((s, i) => {
          const choice = a.choices[i];
          return (
            <div key={i} className="stack" style={{ gap: 6 }}>
              <div className="spread" style={{ alignItems: "flex-start", flexWrap: "nowrap" }}>
                <div>
                  <strong>{String.fromCharCode(97 + i)})</strong> {s.text}
                </div>
                <div className="tf">
                  {[true, false].map((val) => {
                    let cls = "option";
                    if (shown && val === s.answer) cls += " correct";
                    else if (shown && val === choice) cls += " wrong";
                    else if (val === choice) cls += " selected";
                    return (
                      <button
                        key={String(val)}
                        className={cls}
                        disabled={shown}
                        style={{ width: "auto", justifyContent: "center" }}
                        onClick={() =>
                          update({ type: "mtf", choices: a.choices.map((c, j) => (j === i ? val : c)) })
                        }
                      >
                        {val ? "True" : "False"}
                      </button>
                    );
                  })}
                </div>
              </div>
              {shown && (
                <div className="explanation small">
                  <strong>{s.answer ? "True" : "False"}.</strong> {s.explanation}
                </div>
              )}
            </div>
          );
        })}
      </>
    );
  }

  if (q.type === "saq" && a.type === "saq") {
    return (
      <>
        <Markdown>{q.stem}</Markdown>
        <strong>
          <Markdown>{q.question}</Markdown>
        </strong>
        <textarea
          placeholder="Write your answer here…"
          value={a.text}
          readOnly={shown}
          onChange={(e) => update({ ...a, text: e.target.value })}
        />
        {shown && (
          <div className="explanation stack" style={{ gap: 8 }}>
            <div>
              <strong>Model answer</strong>
              <Markdown>{q.modelAnswer}</Markdown>
            </div>
            <div>
              <strong>Marking points — tick what you covered</strong>
              {q.markingPoints.map((m, i) => (
                <label key={i} className="row" style={{ alignItems: "flex-start", flexWrap: "nowrap" }}>
                  <input
                    type="checkbox"
                    checked={a.marks[i]}
                    onChange={(e) =>
                      update({ ...a, marks: a.marks.map((x, j) => (j === i ? e.target.checked : x)) })
                    }
                  />
                  <span>{m}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}
