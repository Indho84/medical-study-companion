import { getExamFormat } from "./examFormats";
import type { GenerateRequest, GenerateResponse, Question } from "./types";

/**
 * Turn Claude's parsed JSON into a GenerateResponse. Used by the API route and
 * by free mode, where the JSON is pasted back from claude.ai and so needs
 * checking more carefully.
 */
export function toResponse(req: GenerateRequest, data: unknown): GenerateResponse {
  if (!data || typeof data !== "object") throw new Error("The answer isn't a JSON object.");
  const d = data as Record<string, unknown>;

  switch (req.kind) {
    case "notes":
    case "mindmap":
      if (typeof d.markdown !== "string" || !d.markdown.trim()) throw missing("markdown");
      return { kind: req.kind, markdown: d.markdown };

    case "flashcards": {
      if (!Array.isArray(d.cards)) throw missing("cards");
      const cards = d.cards
        .filter((c) => c && typeof c.front === "string" && typeof c.back === "string")
        .map((c) => ({ front: c.front, back: c.back, tag: typeof c.tag === "string" ? c.tag : "" }));
      if (!cards.length) throw new Error("No flashcards found in the answer.");
      return { kind: "flashcards", cards };
    }

    case "quiz": {
      if (!Array.isArray(d.questions)) throw missing("questions");
      const type = getExamFormat(req.format).kind;
      const questions = d.questions
        .filter((q) => q && typeof q === "object")
        .map((q) => ({ topic: "", ...q, type }) as Question)
        .filter(isUsable);
      if (!questions.length) throw new Error("No usable questions found in the answer.");
      return { kind: "quiz", questions };
    }

    case "casereport": {
      if (typeof d.draft !== "string") throw missing("draft");
      const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
      return {
        kind: "casereport",
        result: {
          draft: d.draft,
          titleOptions: list(d.titleOptions),
          checklistGaps: list(d.checklistGaps),
          pubmedQueries: list(d.pubmedQueries),
        },
      };
    }
  }
}

function missing(field: string) {
  return new Error(`The answer is missing "${field}". Make sure you copied Claude's whole reply.`);
}

const isStrings = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");
const isIndex = (i: unknown, len: number) => Number.isInteger(i) && (i as number) >= 0 && (i as number) < len;

/** Drop any question that is malformed or whose answer key points outside its options. */
function isUsable(q: Question): boolean {
  switch (q.type) {
    case "sba":
      if (!Array.isArray(q.optionExplanations)) q.optionExplanations = [];
      return (
        typeof q.stem === "string" &&
        isStrings(q.options) &&
        q.options.length >= 2 &&
        isIndex(q.answerIndex, q.options.length)
      );
    case "emq":
      return (
        isStrings(q.options) &&
        Array.isArray(q.items) &&
        q.items.length > 0 &&
        q.items.every((i) => i && typeof i.stem === "string" && isIndex(i.answerIndex, q.options.length))
      );
    case "mtf":
      return (
        Array.isArray(q.statements) &&
        q.statements.length > 0 &&
        q.statements.every((s) => s && typeof s.text === "string" && typeof s.answer === "boolean")
      );
    case "saq":
      return typeof q.question === "string" && isStrings(q.markingPoints) && q.markingPoints.length > 0;
  }
}

/**
 * Pull the JSON object out of a pasted reply, tolerating ```json fences and
 * any chat text Claude adds before or after it.
 */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  const cutOff = new Error(
    "The pasted answer looks cut off or incomplete. If Claude stopped mid-way, ask it to “continue” and paste both parts, or try fewer questions.",
  );
  if (start === -1) {
    throw new Error("Couldn't find the answer in what you pasted. Copy Claude's whole reply, including the { … } part.");
  }
  if (end <= start) throw cutOff;
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    throw cutOff;
  }
}
