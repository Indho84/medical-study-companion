"use client";

import { useEffect, useRef, useState } from "react";
import Generating from "@/components/Generating";
import Markdown from "@/components/Markdown";
import { generate } from "@/lib/api";
import { deleteCase, listCases, newId, saveCase } from "@/lib/db";
import { LANGUAGE_LABELS } from "@/lib/examFormats";
import type { CaseDetails, CaseReport, Language } from "@/lib/types";

const EMPTY: CaseDetails = {
  workingTitle: "",
  patient: "",
  presentation: "",
  history: "",
  examination: "",
  investigations: "",
  diagnosis: "",
  treatment: "",
  outcome: "",
  novelty: "",
  patientPerspective: "",
  targetJournal: "",
  wordLimit: 1500,
  consentObtained: false,
};

const FIELDS: { key: keyof CaseDetails; label: string; placeholder: string; rows?: number }[] = [
  { key: "workingTitle", label: "Working title / condition", placeholder: "e.g. Spontaneous coronary artery dissection in a postpartum woman", rows: 1 },
  { key: "patient", label: "Patient (de-identified)", placeholder: "e.g. 34-year-old woman, 3 weeks postpartum, non-smoker, no cardiac history", rows: 2 },
  { key: "presentation", label: "Presenting complaint", placeholder: "Symptoms, duration, how the patient presented (ED, clinic…)" },
  { key: "history", label: "History", placeholder: "Past medical, drug, family and social history relevant to the case" },
  { key: "examination", label: "Examination", placeholder: "Vital signs and relevant findings" },
  { key: "investigations", label: "Investigations", placeholder: "Labs with values and units, ECG, imaging, histology — with relative timing (day 1, day 3…)", rows: 5 },
  { key: "diagnosis", label: "Diagnosis & differentials", placeholder: "Final diagnosis, differentials considered and how they were excluded, diagnostic challenges" },
  { key: "treatment", label: "Treatment", placeholder: "Interventions with drug, dose, route and duration; procedures; changes in plan" },
  { key: "outcome", label: "Outcome & follow-up", placeholder: "Clinical course, adverse events, status at last follow-up and when" },
  { key: "novelty", label: "Why is this case worth reporting?", placeholder: "Rare condition, unusual presentation, new association, diagnostic pitfall, novel treatment…" },
  { key: "patientPerspective", label: "Patient perspective (optional)", placeholder: "The patient's own words about their experience, if they agreed to share them" },
];

export default function CaseReportPage() {
  const [cases, setCases] = useState<CaseReport[]>([]);
  const [current, setCurrent] = useState<CaseReport>(() => blank());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    listCases().then((cs) => {
      setCases(cs);
      if (cs[0]) setCurrent(cs[0]);
      loaded.current = true;
    });
  }, []);

  // Autosave the case you're working on.
  useEffect(() => {
    if (!loaded.current || !hasContent(current)) return;
    const t = setTimeout(async () => {
      await saveCase(current);
      setCases(await listCases());
    }, 600);
    return () => clearTimeout(t);
  }, [current]);

  const d = current.details;
  const setField = <K extends keyof CaseDetails>(key: K, value: CaseDetails[K]) =>
    setCurrent((c) => ({ ...c, updatedAt: Date.now(), details: { ...c.details, [key]: value } }));

  async function draft() {
    if (current.result && !confirm("Replace the current draft? Copy any edits you want to keep first.")) return;
    setLoading(true);
    setError(null);
    try {
      const { result } = await generate({ kind: "casereport", language: current.language, details: d });
      setCurrent((c) => ({ ...c, updatedAt: Date.now(), result }));
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  function download() {
    if (!current.result) return;
    const blob = new Blob([current.result.draft], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(d.workingTitle || "case-report").slice(0, 60)}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function copy() {
    if (!current.result) return;
    await navigator.clipboard.writeText(current.result.draft);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function remove(c: CaseReport) {
    if (!confirm(`Delete "${c.details.workingTitle || "Untitled case"}"?`)) return;
    await deleteCase(c.id);
    const rest = await listCases();
    setCases(rest);
    if (c.id === current.id) setCurrent(rest[0] ?? blank());
  }

  return (
    <div className="stack">
      <div>
        <h1>Case report writer</h1>
        <p className="muted">
          Enter your case and get a draft structured to the <strong>CARE guidelines</strong>, with a timeline,
          learning points, a list of what's still missing, and PubMed searches for your literature review.
        </p>
      </div>

      <div className="card small" style={{ borderColor: "var(--warn)" }}>
        🔒 <strong>Keep it de-identified.</strong> Don't enter names, initials, dates of birth, exact dates, hospital
        numbers or places. Use relative time ("day 3"). Case details are sent to the Claude API to write the draft.
        You need the patient's <strong>written consent</strong> before submitting to a journal.
      </div>

      <div className="row">
        <button
          onClick={() => {
            setCurrent(blank());
            setEditing(false);
          }}
        >
          + New case
        </button>
        {cases.map((c) => (
          <span key={c.id} className="row" style={{ gap: 0 }}>
            <button
              className={c.id === current.id ? "primary" : ""}
              onClick={() => {
                setCurrent(c);
                setEditing(false);
              }}
            >
              {c.details.workingTitle.slice(0, 40) || "Untitled case"}
            </button>
            <button className="ghost danger small" title="Delete" onClick={() => remove(c)}>
              ✕
            </button>
          </span>
        ))}
      </div>

      <div className="card stack">
        {FIELDS.map((f) => (
          <label key={f.key} className="field">
            {f.label}
            <textarea
              rows={f.rows ?? 3}
              style={{ minHeight: f.rows === 1 ? 0 : undefined }}
              placeholder={f.placeholder}
              value={d[f.key] as string}
              onChange={(e) => setField(f.key, e.target.value)}
            />
          </label>
        ))}
        <div className="row" style={{ alignItems: "flex-end" }}>
          <label className="field">
            Target journal (optional)
            <input
              type="text"
              className="text"
              placeholder="e.g. BMJ Case Reports, Cureus"
              value={d.targetJournal}
              onChange={(e) => setField("targetJournal", e.target.value)}
            />
          </label>
          <label className="field">
            Word limit (main text)
            <input
              type="number"
              min={300}
              max={5000}
              step={100}
              value={d.wordLimit}
              onChange={(e) => setField("wordLimit", Number(e.target.value))}
            />
          </label>
          <label className="field">
            Language
            <select
              value={current.language}
              onChange={(e) => setCurrent((c) => ({ ...c, language: e.target.value as Language }))}
            >
              {Object.entries(LANGUAGE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="row small">
            <input
              type="checkbox"
              checked={d.consentObtained}
              onChange={(e) => setField("consentObtained", e.target.checked)}
            />
            Written consent obtained
          </label>
        </div>
        {loading ? (
          <Generating what="case report draft" />
        ) : (
          <div>
            <button className="primary" onClick={draft}>
              {current.result ? "↻ Redraft" : "Draft case report"}
            </button>
          </div>
        )}
        {error && <div className="error">{error}</div>}
      </div>

      {current.result && (
        <>
          <h2>Title options</h2>
          <ul className="card" style={{ margin: 0, paddingLeft: 36 }}>
            {current.result.titleOptions.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>

          {current.result.checklistGaps.length > 0 && (
            <>
              <h2>✅ To-do before submission</h2>
              <div className="card stack" style={{ gap: 6 }}>
                {current.result.checklistGaps.map((g) => (
                  <label key={g} className="row" style={{ alignItems: "flex-start", flexWrap: "nowrap" }}>
                    <input type="checkbox" />
                    <span>{g}</span>
                  </label>
                ))}
              </div>
            </>
          )}

          <h2>🔎 Literature search (PubMed)</h2>
          <div className="card stack" style={{ gap: 8 }}>
            {current.result.pubmedQueries.map((q) => (
              <div key={q} className="spread" style={{ flexWrap: "nowrap" }}>
                <code className="small" style={{ overflowWrap: "anywhere" }}>
                  {q}
                </code>
                <a
                  className="btn small"
                  href={`https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(q)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Search ↗
                </a>
              </div>
            ))}
            <div className="muted small">
              Replace every <code>[REF: …]</code> placeholder in the draft with a real source you have read. Citations
              are never made up for you.
            </div>
          </div>

          <div className="spread">
            <h2>📄 Draft</h2>
            <div className="row">
              <button onClick={() => setEditing(!editing)}>{editing ? "Preview" : "✎ Edit"}</button>
              <button onClick={copy}>{copied ? "Copied ✓" : "Copy"}</button>
              <button onClick={download}>⬇ Download .md</button>
            </div>
          </div>
          {editing ? (
            <textarea
              style={{ minHeight: "70vh", fontFamily: "ui-monospace, monospace", fontSize: "0.9rem" }}
              value={current.result.draft}
              onChange={(e) =>
                setCurrent((c) => ({ ...c, updatedAt: Date.now(), result: { ...c.result!, draft: e.target.value } }))
              }
            />
          ) : (
            <div className="card">
              <Markdown>{current.result.draft}</Markdown>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function blank(): CaseReport {
  const now = Date.now();
  return { id: newId(), createdAt: now, updatedAt: now, details: { ...EMPTY }, language: "en" };
}

function hasContent(c: CaseReport): boolean {
  return Object.values(c.details).some((v) => typeof v === "string" && v.trim()) || !!c.result;
}
