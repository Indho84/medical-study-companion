import { getExamFormat } from "../examFormats";
import type { CaseDetails, ExamFormatId, GenerateRequest, Language, QuestionKind } from "../types";

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

const CASE_REPORT_SYSTEM_PROMPT = `You are an experienced clinical academic and journal editor helping a medical student write their first case reports for publication. You know the CARE guidelines (CAse REport guidelines, Gagnier et al. 2013) and what editors of case-report journals expect.

Rules you never break:
- Use only the clinical facts the student provides. Never invent findings, results, doses, dates or outcomes. Where something a reader would need is missing, insert a visible placeholder like [ADD: serum sodium on admission] and list it as a gap.
- Never invent references, authors, DOIs or statistics. Wherever a claim needs a citation, insert a placeholder like [REF: incidence of X in adults] so the student can find and cite a real source.
- Keep the patient de-identified: no names, initials, exact dates, hospital numbers or locations. Express time relative to presentation ("on day 3", "at 6-month follow-up"). If the student's input contains identifiers, leave them out of the draft and mention it in the gaps.
- Write in clear, formal academic style suitable for journals such as BMJ Case Reports, Journal of Medical Case Reports or Cureus.`;

export function systemFor(req: GenerateRequest): string {
  return req.kind === "casereport" ? CASE_REPORT_SYSTEM_PROMPT : SYSTEM_PROMPT;
}

function caseReportPrompt(d: CaseDetails, lang: string): string {
  const field = (label: string, value: string) => `<${label}>\n${value.trim() || "(not provided)"}\n</${label}>`;
  return `Here are the details of my case:

${field("working_title", d.workingTitle)}
${field("patient", d.patient)}
${field("presenting_complaint", d.presentation)}
${field("history", d.history)}
${field("examination", d.examination)}
${field("investigations", d.investigations)}
${field("diagnosis_and_differentials", d.diagnosis)}
${field("treatment", d.treatment)}
${field("outcome_and_follow_up", d.outcome)}
${field("why_this_case_is_worth_reporting", d.novelty)}
${field("patient_perspective", d.patientPerspective)}
${field("target_journal", d.targetJournal)}
Written informed consent for publication: ${d.consentObtained ? "obtained" : "NOT yet obtained"}

Draft a case report following the CARE guidelines, about ${d.wordLimit} words for the main text (excluding abstract). ${lang}

Return:
- "titleOptions": 3 alternative titles. Each should contain the words "case report" and name the condition and the key point of interest.
- "draft": the full manuscript in Markdown with these sections: Title, Keywords (3–6), Abstract (structured: Background, Case presentation, Conclusions — max 250 words), Introduction (why this case matters, with [REF] placeholders), Case presentation (history, examination, investigations, diagnosis, treatment, outcome), a Timeline table (relative time → event), Discussion (compare with the literature using [REF] placeholders; explain the clinical reasoning; state the strengths and limitations of the case), Conclusion, a bulleted "Learning points" section (3–5 points, as BMJ Case Reports requires), Patient perspective (only if provided, otherwise a placeholder), and an Informed consent statement. If a target journal is given, follow its known section conventions.
- "checklistGaps": each CARE checklist item or piece of information that is missing or weak, as a short actionable to-do (e.g. "Add the treatment dose and duration"). Include consent if it is not yet obtained.
- "pubmedQueries": 3–5 ready-to-paste PubMed search strings (using MeSH terms and Boolean operators) to find the literature for the Introduction and Discussion, including one to check whether similar cases have already been reported.`;
}

export function buildUserPrompt(req: GenerateRequest): string {
  if (req.kind === "casereport") return caseReportPrompt(req.details, languageInstruction(req.language));

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
      return quizPrompt(req.format, req.count, slides, lang, req.focusTopics);
  }
}

function quizPrompt(
  formatId: ExamFormatId,
  count: number,
  slides: string,
  lang: string,
  focusTopics?: string[],
): string {
  const format = getExamFormat(formatId);
  const unit = format.kind === "emq" ? "EMQ sets" : "questions";
  const focus = focusTopics?.length
    ? `\nThe student has been getting these topics wrong: ${focusTopics.map((t) => `"${t}"`).join(", ")}. Make about 80% of the ${unit} test these topics from new angles (different presentations, mechanisms, next steps) so the student cannot rely on remembering earlier questions, and the rest a mix of the lecture. Use the same topic labels for those ${unit}.\n`
    : "";
  return `${slides}

Write ${count} ${unit} in the "${format.label}" format, based on these slides. ${lang}
${focus}
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

const caseReportSchema = obj({
  titleOptions: { type: "array", items: str },
  draft: str,
  checklistGaps: { type: "array", items: str },
  pubmedQueries: { type: "array", items: str },
});

export function schemaFor(req: GenerateRequest): Record<string, unknown> {
  switch (req.kind) {
    case "casereport":
      return caseReportSchema;
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
