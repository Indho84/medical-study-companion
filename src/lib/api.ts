"use client";

import type { GenerateRequest, GenerateResponse } from "./types";

export async function generate<K extends GenerateRequest["kind"]>(
  req: Extract<GenerateRequest, { kind: K }>,
): Promise<Extract<GenerateResponse, { kind: K }>> {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  const data = await res.json().catch(() => ({ error: `Server error (${res.status})` }));
  if (!res.ok) throw new Error(data.error ?? `Server error (${res.status})`);
  return data;
}
