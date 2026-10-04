import { getExamFormat } from "../examFormats";
import type { ExamFormatId, GenerateRequest, Language, QuestionKind } from "../types";

export const SYSTEM_PROMPT = `You are an experienced medical educator and exam item-writer helping a final-year medical student revise from their own lecture slides. The student is preparing for USMLE, PLAB, TUS and AMC as well as their faculty exams.

Ground everything in the slide text you are given: cover what the slides teach, in proportion to how much the slides emphasise it. You may add brief, widely accepted high-yield context (e.g. a classic association or a first-line drug the slides imply but do not name) when it clearly helps the student understand or answer a question, but never contradict the slides and never invent statistics, guidelines or references. If the slides contain something that is outdated or incorrect, keep the slide's content but add a short note flagging the current standard.

The slide text was extracted automatically, so it may contain broken line wraps, repeated headers/footers, slide numbers or garbled table text — interpret it sensibly and ignore the noise.`;

function languageInstruction(language: Language): string {
  return language === "tr"
    ? "Write all output in Turkish (Türkçe), using standard Turkish medical terminology. Give the English/Latin term in brackets the first time a key term appears."
    : "Write all output in English.";
}

function slidesBlock(title: string, text: string): string {
  return `<slides title="${title.replace(/"/g, "'")}">\n${text}\n</slides>`;
}

export function buildUserPrompt(req: GenerateRequest): string {
  const slides = slidesBlock(req.title, req.text);
  const lang = languageInstruction(req.language);

  switch (req.kind) {
    case "notes":
      return `${slides}

Write high-yield "spot notes" for rapid revision from these slides. ${lang}

Format (GitHub-flavoured Markdown, returned in the "markdown" field):
- Start with a 2–3 line "Bottom line" summary of the lecture.
- Then sections with "##" headings following the logical structure of the lecture (definition → epidemiology → aetiology/pathophysiology → clinical features → investigations → management → complications/prognosis, where applicable).
- Terse bullet points, not prose. **Bold** the key words an examiner would look for.
- Use Markdown tables for comparisons/classifications (e.g. differential diagnoses, drug classes, types of a disease).
- Include a "Classic exam associations" section (buzzword → answer) and a "Mnemonics" section where genuinely useful.
- Finish with "Common exam traps" — 3–6 points where students typically lose marks.`;

    case "mindmap":
      return `${slides}

Build a mind map of this lecture. ${lang}

Return it in the "markdown" field as a Markdown outline that will be rendered with markmap:
- Exactly one "#" heading: the central topic.
- "##" headings for the main branches (usually 4–8), "###" for sub-branches, and "-" bullets for leaves. Nest bullets for deeper levels where needed.
- Every node must be short (ideally 1–6 words; leaves at most ~12 words). Use **bold** for the most exam-relevant nodes.
- Capture the structure and relationships of the lecture (classifications, causes, features, investigations, management), not full sentences.`;

    case "flashcards":
      return `${slides}

Create ${req.count} high-quality Anki-style flashcards from these slides. ${lang}

Rules:
- One fact or concept per card (minimum information principle). The front is a precise question or cue; the back is the shortest complete answer.
- Mix card types: definitions, mechanisms ("Why…?"), "most common…", first-line treatment, diagnostic criteria, buzzword → diagnosis, and short clinical vignettes → diagnosis/next step. You may use cloze style on the front with "____".
- Lists longer than 4 items should be split or turned into a mnemonic.
- Spread the cards across the whole lecture in proportion to its emphasis; avoid duplicates.
- "tag" is a short topic label (1–3 words) for the part of the lecture the card comes from.`;

    case "quiz":
      return quizPrompt(req.format, req.count, slides, lang);
  }
}

function quizPrompt(formatId: ExamFormatId, count: number, slides: string, lang: string): string {
  const format = getExamFormat(formatId);
  const unit = format.kind === "emq" ? "EMQ sets" : "questions";
  return `${slides}

Write ${count} ${unit} in the "${format.label}" format, based on these slides. ${lang}

Format guide:
${format.guidance}

General rules:
- Each item must have exactly one defensible correct answer according to the slides and current standard practice.
- Distractors must be plausible to a student who has only partially learned the topic.
- Vary which option position holds the correct answer.
- Explanations should teach: say why the answer is right, and (for SBA) give a one-line reason each distractor is wrong. Mention the key slide concept being tested.
- "topic" is a short label (1–3 words) for the part of the lecture tested.
- Do not put the letter (A, B, …) inside option text — the app adds letters itself.
- Indices are zero-based (0 = A, 1 = B, …).`;
}

/* ---------------- JSON schemas for structured outputs ---------------- */

const str = { type: "string" } as const;
const int = { type: "integer" } as const;

function obj(properties: Record<string, unknown>) {
  return {
    type: "object",
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  };
}

const markdownSchema = obj({ markdown: str });

const flashcardSchema = obj({
  cards: { type: "array", items: obj({ front: str, back: str, tag: str }) },
});

const questionSchemas: Record<QuestionKind, Record<string, unknown>> = {
  sba: obj({
    stem: str,
    leadIn: str,
    options: { type: "array", items: str },
    answerIndex: int,
    explanation: str,
    optionExplanations: {
      type: "array",
      items: str,
      description: "One short line per option, in the same order as options.",
    },
    topic: str,
  }),
  emq: obj({
    theme: str,
    options: { type: "array", items: str },
    leadIn: str,
    items: {
      type: "array",
      items: obj({ stem: str, answerIndex: int, explanation: str }),
    },
    topic: str,
  }),
  mtf: obj({
    stem: str,
    statements: {
      type: "array",
      items: obj({ text: str, answer: { type: "boolean" }, explanation: str }),
    },
    topic: str,
  }),
  saq: obj({
    stem: str,
    question: str,
    modelAnswer: str,
    markingPoints: { type: "array", items: str },
    topic: str,
  }),
};

export function schemaFor(req: GenerateRequest): Record<string, unknown> {
  switch (req.kind) {
    case "notes":
    case "mindmap":
      return markdownSchema;
    case "flashcards":
      return flashcardSchema;
    case "quiz": {
      const kind = getExamFormat(req.format).kind;
      return obj({ questions: { type: "array", items: questionSchemas[kind] } });
    }
  }
}
