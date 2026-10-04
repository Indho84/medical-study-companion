"use client";

import { useEffect, useState } from "react";

/** Loading state for a Claude generation, with elapsed time so long runs don't look stuck. */
export default function Generating({ what }: { what: string }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="card row">
      <span className="spinner" />
      <div>
        <div>Claude is writing your {what}…</div>
        <div className="muted small">
          {seconds}s · long lectures and big quizzes can take 1–3 minutes. Keep this tab open.
        </div>
      </div>
    </div>
  );
}
