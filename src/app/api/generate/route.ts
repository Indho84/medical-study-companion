import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { EXAM_FORMATS } from "@/lib/examFormats";
import { describeApiError, runGeneration } from "@/lib/claudeRequest";
import type { ModelId } from "@/lib/models";
import type { GenerateRequest } from "@/lib/types";

// Generating a full quiz from a long lecture can take a couple of minutes.
export const maxDuration = 300;

const MODEL: ModelId = "claude-opus-5-5";
const MAX_SLIDE_CHARS = 400_000; // ~100k tokens — far more than any single lecture

const client = new Anthropic();

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function validate(body: unknown): GenerateRequest | string {
  if (!body || typeof body !== "object") return "Invalid request body.";
  const b = body as Record<string, unknown>;
  if (!["notes", "mindmap", "flashcards", "quiz", "casereport"].includes(b.kind as string)) return "Unknown kind.";
  if (b.language !== "en" && b.language !== "tr") return "Unknown language.";
  if (b.kind === "casereport") {
    const d = b.details as Record<string, unknown> | undefined;
    if (!d || typeof d !== "object") return "Missing case details.";
    const text = Object.values(d).filter((v) => typeof v === "string").join(" ");
    if (text.trim().length < 100) return "Add more case details (at least the presentation, investigations and outcome).";
    if (text.length > MAX_SLIDE_CHARS) return "Case details are too long.";
    if (typeof d.wordLimit !== "number" || d.wordLimit < 300 || d.wordLimit > 5000) return "Word limit must be 300–5000.";
    return b as unknown as GenerateRequest;
  }
  if (typeof b.text !== "string" || b.text.trim().length < 50)
    return "Not enough slide text to work with. Is this a scanned/image-only file?";
  if (b.text.length > MAX_SLIDE_CHARS)
    return "This file is very large. Split it into smaller lectures and upload them separately.";
  if (typeof b.title !== "string") return "Missing title.";
  if (b.kind === "flashcards" || b.kind === "quiz") {
    if (typeof b.count !== "number" || b.count < 1 || b.count > 60) return "count must be 1–60.";
  }
  if (b.kind === "quiz" && !EXAM_FORMATS.some((f) => f.id === b.format)) return "Unknown exam format.";
  if (
    b.focusTopics !== undefined &&
    (!Array.isArray(b.focusTopics) || b.focusTopics.length > 20 || !b.focusTopics.every((t) => typeof t === "string"))
  )
    return "focusTopics must be a list of up to 20 topics.";
  return b as unknown as GenerateRequest;
}

/** Lets the browser check whether one-click (API) mode is available; otherwise it uses free mode. */
export async function GET() {
  return NextResponse.json({ configured: Boolean(process.env.ANTHROPIC_API_KEY) });
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return bad("ANTHROPIC_API_KEY is not set on the server. Add it to .env.local and restart.", 500);
  }

  const parsed = validate(await request.json().catch(() => null));
  if (typeof parsed === "string") return bad(parsed);
  const req = parsed;

  try {
    return NextResponse.json(await runGeneration(client, req, MODEL));
  } catch (error) {
    const status =
      error instanceof Anthropic.RateLimitError ? 429 : error instanceof Anthropic.APIError ? 502 : 422;
    if (!(error instanceof Error)) console.error(error);
    return bad(describeApiError(error), status);
  }
}
