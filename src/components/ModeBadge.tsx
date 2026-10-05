"use client";

import Link from "next/link";
import { useAi } from "@/lib/ai";
import { MODELS } from "@/lib/models";

export default function ModeBadge() {
  const { mode, settings } = useAi();
  if (mode === "checking") return null;
  return (
    <Link href="/settings" title="Change how content is generated">
      {mode === "free" ? (
        <span className="pill accent">🆓 Free mode</span>
      ) : (
        <span className="pill good">⚡ One-click{mode === "key" ? ` · ${MODELS[settings.model].short}` : ""}</span>
      )}
    </Link>
  );
}
