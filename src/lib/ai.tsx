"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { extractJson, toResponse } from "./postprocess";
import { buildCopyPrompt } from "./prompts";
import type { GenerateRequest, GenerateResponse } from "./types";

/**
 * Two ways to get content from Claude:
 * - "api":  the server has an ANTHROPIC_API_KEY, so one click generates everything.
 * - "free": no key (e.g. the free GitHub Pages site). The app builds a prompt, the
 *           student pastes it into claude.ai, then pastes Claude's reply back.
 */
export type AiMode = "api" | "free" | "checking";

type Generate = <K extends GenerateRequest["kind"]>(
  req: Extract<GenerateRequest, { kind: K }>,
) => Promise<Extract<GenerateResponse, { kind: K }>>;

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const STATIC_SITE = process.env.NEXT_PUBLIC_STATIC_EXPORT === "1";

export class CancelledError extends Error {
  constructor() {
    super("Cancelled.");
  }
}

export const isCancel = (e: unknown) => e instanceof CancelledError;

interface Pending {
  req: GenerateRequest;
  resolve: (r: GenerateResponse) => void;
  reject: (e: Error) => void;
}

const AiContext = createContext<{ mode: AiMode; generate: Generate } | null>(null);

// Checked once per page load: does the server have an API key?
let modeCheck: Promise<"api" | "free"> | null = null;
function detectMode(): Promise<"api" | "free"> {
  if (STATIC_SITE) return Promise.resolve("free");
  modeCheck ??= fetch(`${BASE_PATH}/api/generate`)
    .then((r) => (r.ok ? r.json() : { configured: false }))
    .then((d) => (d.configured ? "api" : "free") as "api" | "free")
    .catch(() => "free" as const);
  return modeCheck;
}

export function AiProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<AiMode>(STATIC_SITE ? "free" : "checking");
  const [pending, setPending] = useState<Pending | null>(null);

  useEffect(() => {
    detectMode().then(setMode);
  }, []);

  const generate = useCallback(
    (async (req: GenerateRequest) => {
      // A click right after page load must wait for the check, not fall back to free mode.
      if ((await detectMode()) === "api") return callApi(req);
      return new Promise<GenerateResponse>((resolve, reject) => setPending({ req, resolve, reject }));
    }) as Generate,
    [],
  );

  return (
    <AiContext.Provider value={{ mode, generate }}>
      {children}
      {pending && (
        <FreeModeDialog
          req={pending.req}
          onDone={(r) => {
            pending.resolve(r);
            setPending(null);
          }}
          onCancel={() => {
            pending.reject(new CancelledError());
            setPending(null);
          }}
        />
      )}
    </AiContext.Provider>
  );
}

export function useAi() {
  const ctx = useContext(AiContext);
  if (!ctx) throw new Error("useAi must be used inside <AiProvider>");
  return ctx;
}

async function callApi(req: GenerateRequest): Promise<GenerateResponse> {
  const res = await fetch(`${BASE_PATH}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  const data = await res.json().catch(() => ({ error: `Server error (${res.status})` }));
  if (!res.ok) throw new Error(data.error ?? `Server error (${res.status})`);
  return data;
}

const WHAT: Record<GenerateRequest["kind"], string> = {
  notes: "spot notes",
  mindmap: "mind map",
  flashcards: "flashcards",
  quiz: "quiz",
  casereport: "case report draft",
};

function FreeModeDialog({
  req,
  onDone,
  onCancel,
}: {
  req: GenerateRequest;
  onDone: (r: GenerateResponse) => void;
  onCancel: () => void;
}) {
  const prompt = useRef(buildCopyPrompt(req)).current;
  const [copied, setCopied] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const promptBox = useRef<HTMLTextAreaElement>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
    } catch {
      // Clipboard API blocked (older phones): show the text so it can be copied by hand.
      setShowPrompt(true);
      setTimeout(() => promptBox.current?.select(), 0);
    }
  }

  function create() {
    setError(null);
    try {
      onDone(toResponse(req, extractJson(answer)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const tooLong = prompt.length > 300_000;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal aria-labelledby="free-title">
      <div className="modal card stack">
        <div className="spread" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
          <h2 id="free-title" style={{ margin: 0 }}>
            Make your {WHAT[req.kind]} with Claude (free)
          </h2>
          <button className="ghost" onClick={onCancel} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="step">
          <span className="step-num">1</span>
          <div className="stack" style={{ gap: 6, flex: 1 }}>
            <div>Copy the prompt. It already contains your slides and all the instructions.</div>
            <div className="row">
              <button className="primary" onClick={copy}>
                {copied ? "Copied ✓" : "📋 Copy prompt"}
              </button>
              <button className="ghost small" onClick={() => setShowPrompt(!showPrompt)}>
                {showPrompt ? "Hide" : "Show"} prompt
              </button>
              <span className="muted small">{Math.round(prompt.length / 1000)}k characters</span>
            </div>
            {tooLong && (
              <div className="error small">
                This lecture is very long and may be too big for claude.ai. If Claude refuses, split the file into
                smaller parts.
              </div>
            )}
            {showPrompt && <textarea ref={promptBox} readOnly value={prompt} style={{ minHeight: 140 }} />}
          </div>
        </div>

        <div className="step">
          <span className="step-num">2</span>
          <div className="stack" style={{ gap: 6, flex: 1 }}>
            <div>Open Claude, paste the prompt into a new chat and send it.</div>
            <div>
              <a className="btn" href="https://claude.ai/new" target="_blank" rel="noreferrer">
                Open claude.ai ↗
              </a>
            </div>
            <div className="muted small">
              Wait until Claude has completely finished. If it stops halfway, type “continue”.
            </div>
          </div>
        </div>

        <div className="step">
          <span className="step-num">3</span>
          <div className="stack" style={{ gap: 6, flex: 1 }}>
            <div>Copy Claude&apos;s whole reply (use the copy button under it) and paste it here:</div>
            <textarea
              placeholder='Paste Claude’s reply here — it starts with ```json or {'
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              style={{ minHeight: 140 }}
            />
            {error && <div className="error small">{error}</div>}
            <div className="row">
              <button className="primary" disabled={!answer.trim()} onClick={create}>
                ✓ Create {WHAT[req.kind]}
              </button>
              <button className="ghost" onClick={onCancel}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
