import type { ExamFormatId, Language, QuestionKind } from "./types";

export interface ExamFormat {
  id: ExamFormatId;
  label: string;
  short: string;
  kind: QuestionKind;
  /** Approximate time per question in the real exam, used for timed mode. */
  secondsPerQuestion: number;
  defaultLanguage: Language;
  description: string;
  /** Style guide sent to Claude when writing questions in this format. */
  guidance: string;
}

export const EXAM_FORMATS: ExamFormat[] = [
  {
    id: "usmle",
    label: "USMLE Step 1 / Step 2 CK",
    short: "USMLE",
    kind: "sba",
    secondsPerQuestion: 90,
    defaultLanguage: "en",
    description: "Long clinical vignettes, single best answer (A–E), ~90 s per question.",
    guidance: `USMLE-style single best answer (NBME item-writing style).
- Stem: a full clinical vignette — age, sex, setting, presenting complaint, relevant history, vital signs, examination, and labs/imaging where appropriate. Do not name the diagnosis in the stem.
- Lead-in: a single, closed question that can be answered without looking at the options ("Which of the following is the most likely diagnosis / most appropriate next step in management / underlying mechanism…?").
- Test second- and third-order reasoning (e.g. diagnosis → mechanism → drug adverse effect), not isolated recall.
- Exactly 5 homogeneous options (all diagnoses, all drugs, etc.), similar length, no "all of the above"/"none of the above".
- US conventions: US generic drug names, conventional units with SI in brackets where helpful, US guidelines.`,
  },
  {
    id: "plab",
    label: "PLAB 1 (UK GMC)",
    short: "PLAB 1",
    kind: "sba",
    secondsPerQuestion: 60,
    defaultLanguage: "en",
    description: "UK practice SBA (A–E), NICE/BNF based, ~1 min per question.",
    guidance: `PLAB 1 single best answer (UK GMC style).
- Stem: a concise clinical scenario set in UK practice at the level of a foundation-year (FY2) doctor — GP, A&E, ward or on-call settings.
- Lead-in: "What is the most appropriate next step / most likely diagnosis / most appropriate initial investigation?" etc.
- Management must follow current UK guidance (NICE, BNF, Resuscitation Council UK, SIGN). Use UK drug names (paracetamol, adrenaline, salbutamol), SI units, UK terminology (A&E, GP, FY1, consultant).
- Emphasise safe practice, ethics/GMC Good Medical Practice where relevant, and first-line management.
- Exactly 5 options, one best answer, plausible distractors.`,
  },
  {
    id: "amc",
    label: "AMC CAT MCQ (Australia)",
    short: "AMC",
    kind: "sba",
    secondsPerQuestion: 84,
    defaultLanguage: "en",
    description: "Australian context SBA (A–E), eTG/RACGP based, ~84 s per question.",
    guidance: `Australian Medical Council (AMC) CAT MCQ — single best answer.
- Stem: a clinical scenario in Australian practice (general practice, emergency department, rural/remote settings, Aboriginal and Torres Strait Islander health where relevant).
- Management should follow Australian guidance (Therapeutic Guidelines/eTG, RACGP, Australian immunisation handbook, PBS-available drugs). SI units.
- Cover adult medicine, surgery, paediatrics, O&G, psychiatry and population health as fits the source material.
- Exactly 5 options, one best answer.`,
  },
  {
    id: "tus",
    label: "TUS (Tıpta Uzmanlık Sınavı)",
    short: "TUS",
    kind: "sba",
    secondsPerQuestion: 75,
    defaultLanguage: "tr",
    description: "Temel & Klinik Bilimler, 5 şıklı (A–E), kısa ve bilgi yoğun sorular.",
    guidance: `TUS (Turkish medical specialty exam, ÖSYM style) — single best answer, 5 options (A–E).
- Mix of Temel Bilimler (anatomy, physiology, biochemistry, microbiology, pathology, pharmacology) and Klinik Bilimler items as fits the source material.
- Stems are shorter and more knowledge-dense than USMLE; many are direct "which of the following" knowledge items, some are short clinical cases.
- Include some negatively-phrased items in TUS style ("…aşağıdakilerden hangisi yanlıştır?", "…hangisi beklenmez?", "…hangisi değildir?") — roughly 1 in 4 questions. When a question is negatively phrased, the correct answer is the false/unexpected option.
- Classic textbook facts, "en sık" (most common), "ilk tercih" (first choice), "tanı koydurucu" (diagnostic) type questions are typical.
- Use standard Turkish medical terminology (with Latin/English term in brackets when helpful).`,
  },
  {
    id: "school_sba",
    label: "School exam — MCQ / SBA",
    short: "School SBA",
    kind: "sba",
    secondsPerQuestion: 60,
    defaultLanguage: "en",
    description: "Faculty-style single best answer questions mixing recall and short cases.",
    guidance: `Medical school end-of-block exam, single best answer.
- Mix roughly 50% direct knowledge/recall items and 50% short clinical cases, mirroring what a lecturer would ask from these slides.
- Stick closely to what the slides teach (definitions, classifications, mechanisms, criteria, first-line treatments, numbers the lecturer emphasises).
- Exactly 5 options, one best answer.`,
  },
  {
    id: "emq",
    label: "Extended Matching (EMQ)",
    short: "EMQ",
    kind: "emq",
    secondsPerQuestion: 90,
    defaultLanguage: "en",
    description: "A theme with 8–12 options and several stems that each match one option.",
    guidance: `Extended Matching Questions (EMQ).
- Each EMQ has a theme (e.g. "Causes of chest pain"), a list of 8–12 homogeneous options, a lead-in instruction, and 3–5 short clinical stems.
- Each stem matches exactly one option; options may be used once, more than once, or not at all.
- "count" refers to the number of EMQ sets (themes), not individual stems.`,
  },
  {
    id: "mtf",
    label: "Multiple True / False",
    short: "True/False",
    kind: "mtf",
    secondsPerQuestion: 90,
    defaultLanguage: "en",
    description: "A stem with 5 statements, each to be marked true or false.",
    guidance: `Multiple True/False (MTF / "K-type" style used in many faculties).
- Each question has a short stem (a topic or a short case) followed by exactly 5 statements.
- Each statement is independently true or false; aim for a balanced mix across the quiz.
- False statements should be plausible misconceptions, not obviously wrong.`,
  },
  {
    id: "saq",
    label: "Short Answer (SAQ)",
    short: "SAQ",
    kind: "saq",
    secondsPerQuestion: 300,
    defaultLanguage: "en",
    description: "Written questions with a model answer and marking points for self-marking.",
    guidance: `Short Answer Questions (SAQ), as used in written faculty exams.
- A short scenario or prompt, then a focused question ("List four…", "Explain the mechanism of…", "Outline the initial management of…").
- Provide a concise model answer and 3–8 discrete marking points (1 mark each) a marker would look for.`,
  },
];

export function getExamFormat(id: ExamFormatId): ExamFormat {
  const format = EXAM_FORMATS.find((f) => f.id === id);
  if (!format) throw new Error(`Unknown exam format: ${id}`);
  return format;
}

export const LANGUAGE_LABELS: Record<Language, string> = {
  en: "English",
  tr: "Türkçe",
};
