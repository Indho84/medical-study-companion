"use client";

import { useEffect, useState } from "react";
import { useAi } from "@/lib/ai";
import { MODELS, type ModelId } from "@/lib/models";

export default function SettingsPage() {
  const { mode, settings, updateSettings } = useAi();
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState<ModelId>(settings.model);
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    setApiKey(settings.apiKey);
    setModel(settings.model);
  }, [settings]);

  async function save() {
    const key = apiKey.trim();
    if (key && !key.startsWith("sk-ant-")) {
      setStatus({ ok: false, text: "That doesn't look like an Anthropic API key — it should start with sk-ant-." });
      return;
    }
    const saved = updateSettings({ apiKey: key, model });
    setStatus(
      saved
        ? { ok: true, text: key ? "Saved. Generate buttons now work in one click." : "Saved." }
        : { ok: false, text: "Couldn't save — your browser is blocking storage (private mode?)." },
    );
  }

  async function test() {
    setTesting(true);
    setStatus(null);
    try {
      const [{ default: Anthropic }, { describeApiError }] = await Promise.all([
        import("@anthropic-ai/sdk"),
        import("@/lib/claudeRequest"),
      ]);
      const client = new Anthropic({ apiKey: apiKey.trim(), dangerouslyAllowBrowser: true });
      try {
        // Looking up the model checks the key without spending any credit.
        await client.models.retrieve(model);
        setStatus({ ok: true, text: "✅ Your key works. Click Save to start using it." });
      } catch (e) {
        setStatus({ ok: false, text: describeApiError(e) });
      }
    } finally {
      setTesting(false);
    }
  }

  function remove() {
    if (!confirm("Remove your API key from this browser? The site will go back to free copy-paste mode.")) return;
    setApiKey("");
    updateSettings({ apiKey: "", model });
    setStatus({ ok: true, text: "Key removed. You're back in free mode." });
  }

  return (
    <div className="stack">
      <div>
        <h1>Settings</h1>
        <p className="muted">
          Currently:{" "}
          {mode === "key" ? (
            <strong>⚡ One-click mode with your API key ({MODELS[settings.model].short})</strong>
          ) : mode === "api" ? (
            <strong>⚡ One-click mode (key set on the server)</strong>
          ) : (
            <strong>🆓 Free mode — copy &amp; paste with claude.ai</strong>
          )}
        </p>
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>One-click generation with your own API key</h2>
        <p className="muted small" style={{ margin: 0 }}>
          With a key, every Generate button works instantly — no copy-paste. You only pay Anthropic for what you use,
          and the website itself stays free.
        </p>

        <label className="field">
          API key
          <div className="row" style={{ flexWrap: "nowrap" }}>
            <input
              type={show ? "text" : "password"}
              className="text"
              style={{ flex: 1, minWidth: 0 }}
              placeholder="sk-ant-…"
              autoComplete="off"
              spellCheck={false}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <button type="button" className="ghost small" onClick={() => setShow(!show)}>
              {show ? "Hide" : "Show"}
            </button>
          </div>
        </label>

        <label className="field">
          Model
          <select value={model} onChange={(e) => setModel(e.target.value as ModelId)}>
            {Object.entries(MODELS).map(([id, m]) => (
              <option key={id} value={id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>

        <div className="row">
          <button className="primary" onClick={save}>
            Save
          </button>
          <button onClick={test} disabled={!apiKey.trim() || testing}>
            {testing ? "Testing…" : "Test key (free)"}
          </button>
          {settings.apiKey && (
            <button className="ghost danger" onClick={remove}>
              Remove key
            </button>
          )}
        </div>
        {status && <div className={status.ok ? "notice-ok" : "error"}>{status.text}</div>}

        <div className="small muted">
          🔒 Your key is saved <strong>only in this browser on this device</strong>. It is never uploaded to GitHub or
          anywhere else except Anthropic. Don&apos;t save it on a shared or public computer. You&apos;ll need to enter
          it once on each device you use.
        </div>
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>How to get an API key (5 minutes)</h2>
        <ol className="stack" style={{ margin: 0, paddingLeft: 20, gap: 8 }}>
          <li>
            Go to{" "}
            <a href="https://console.anthropic.com/" target="_blank" rel="noreferrer">
              console.anthropic.com
            </a>{" "}
            and sign up (you can use your Google account).
          </li>
          <li>
            Open <strong>Billing</strong> (in Settings), add a card and buy a small amount of credit — <strong>$5 is
            enough to start</strong>. Turn off auto-reload so you can never be charged more than you add.
          </li>
          <li>
            Open <strong>API keys</strong> → <strong>Create key</strong>, name it &quot;study site&quot;, and copy it.
            It starts with <code>sk-ant-</code> and is shown only once.
          </li>
          <li>
            Paste it above, click <strong>Test key</strong>, then <strong>Save</strong>.
          </li>
        </ol>
        <div className="small muted">
          Rough cost with Haiku: a few cents for notes, a mind map or flashcards, and roughly 5–15 cents for a quiz, so
          $5 lasts for many lectures. Opus gives better questions but costs about 4× more. You can see your spending at
          any time in the console.
        </div>
      </div>
    </div>
  );
}
