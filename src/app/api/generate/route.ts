import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { EXAM_FORMATS, getExamFormat } from "@/lib/examFormats";
import { SYSTEM_PROMPT, buildUserPrompt, schemaFor } from "@/lib/server/prompts";
import type { GenerateRequest, GenerateResponse, Question } from "@/lib/types";

// Generating a full quiz from a long lecture can take a couple of minutes.
export const maxDuration = 300;

const MODEL = "claude-opus-5-5";
const MAX_SLIDE_CHARS = 400_000; // ~100k tokens — far more than any single lecture

const client = new Anthropic();

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function validate(body: unknown): GenerateRequest | string {
  if (!body || typeof body !== "object") return "Invalid request body.";
  const b = body as Record<string, unknown>;
  if (!["notes", "mindmap", "flashcards", "quiz"].includes(b.kind as string)) return "Unknown kind.";
  if (typeof b.text !== "string" || b.text.trim().length < 50)
    return "Not enough slide text to work with. Is this a scanned/image-only file?";
  if (b.text.length > MAX_SLIDE_CHARS)
    return "This file is very large. Split it into smaller lectures and upload them separately.";
  if (typeof b.title !== "string") return "Missing title.";
  if (b.language !== "en" && b.language !== "tr") return "Unknown language.";
  if (b.kind === "flashcards" || b.kind === "quiz") {
    if (typeof b.count !== "number" || b.count < 1 || b.count > 60) return "count must be 1–60.";
  }
  if (b.kind === "quiz" && !EXAM_FORMATS.some((f) => f.id === b.format)) return "Unknown exam format.";
  return b as unknown as GenerateRequest;
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return bad("ANTHROPIC_API_KEY is not set on the server. Add it to .env.local and restart.", 500);
  }

  const parsed = validate(await request.json().catch(() => null));
  if (typeof parsed === "string") return bad(parsed);
  const req = parsed;

  try {
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 64000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: {
        effort: req.kind === "quiz" ? "high" : "medium",
        format: { type: "json_schema", schema: schemaFor(req) },
      },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(req) }],
    });
    const message = await stream.finalMessage();

    if (message.stop_reason === "refusal") {
      return bad("Claude declined to generate this content. Try a different section of the slides.", 422);
    }
    if (message.stop_reason === "max_tokens") {
      return bad("The response was too long and got cut off. Try a smaller number of items.", 422);
    }

    const text = message.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");
    const data = JSON.parse(text);

    let result: GenerateResponse;
    switch (req.kind) {
      case "notes":
      case "mindmap":
        result = { kind: req.kind, markdown: data.markdown };
        break;
      case "flashcards":
        result = { kind: "flashcards", cards: data.cards };
        break;
      case "quiz": {
        const type = getExamFormat(req.format).kind;
        const questions = (data.questions as Omit<Question, "type">[]).map(
          (q) => ({ ...q, type }) as Question,
        );
        result = { kind: "quiz", questions: questions.filter(isUsable) };
        break;
      }
    }
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return bad("The Anthropic API key was rejected. Check ANTHROPIC_API_KEY.", 500);
    }
    if (error instanceof Anthropic.RateLimitError) {
      return bad("Rate limited by the Anthropic API — wait a minute and try again.", 429);
    }
    if (error instanceof Anthropic.APIError) {
      return bad(`Anthropic API error (${error.status}): ${error.message}`, 502);
    }
    if (error instanceof SyntaxError) {
      return bad("Claude returned malformed output. Please try again.", 502);
    }
    console.error(error);
    return bad("Unexpected server error.", 500);
  }
}

/** Drop any question whose answer key points outside its options. */
function isUsable(q: Question): boolean {
  switch (q.type) {
    case "sba":
      return q.options.length >= 2 && q.answerIndex >= 0 && q.answerIndex < q.options.length;
    case "emq":
      return q.items.length > 0 && q.items.every((i) => i.answerIndex >= 0 && i.answerIndex < q.options.length);
    case "mtf":
      return q.statements.length > 0;
    case "saq":
      return q.markingPoints.length > 0;
  }
}
