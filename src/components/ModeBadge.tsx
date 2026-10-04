"use client";

import { useAi } from "@/lib/ai";

export default function ModeBadge() {
  const { mode } = useAi();
  if (mode === "checking") return null;
  return mode === "api" ? (
    <span className="pill good" title="Content is generated automatically with your API key">
      ⚡ One-click mode
    </span>
  ) : (
    <span className="pill accent" title="Content is made by pasting a prompt into claude.ai — no API key needed">
      🆓 Free mode
    </span>
  );
}
