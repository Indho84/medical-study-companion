export type Language = "en" | "tr";

export type ExamFormatId =
  | "usmle"
  | "plab"
  | "amc"
  | "tus"
  | "school_sba"
  | "emq"
  | "mtf"
  | "saq";

export type QuestionKind = "sba" | "emq" | "mtf" | "saq";

export interface SbaQuestion {
  type: "sba";
  stem: string;
  leadIn: string;
  options: string[];
  answerIndex: number;
  explanation: string;
  optionExplanations: string[];
  topic: string;
}

export interface EmqQuestion {
  type: "emq";
  theme: string;
  options: string[];
  leadIn: string;
  items: { stem: string; answerIndex: number; explanation: string }[];
  topic: string;
}

export interface MtfQuestion {
  type: "mtf";
  stem: string;
  statements: { text: string; answer: boolean; explanation: string }[];
  topic: string;
}

export interface SaqQuestion {
  type: "saq";
  stem: string;
  question: string;
  modelAnswer: string;
  markingPoints: string[];
  topic: string;
}

export type Question = SbaQuestion | EmqQuestion | MtfQuestion | SaqQuestion;

export interface TopicResult {
  correct: number;
  total: number;
}

export interface QuizAttempt {
  finishedAt: number;
  score: number;
  total: number;
  /** Points per question topic; missing on attempts saved before topic tracking existed. */
  topics?: Record<string, TopicResult>;
}

export interface Quiz {
  id: string;
  format: ExamFormatId;
  language: Language;
  createdAt: number;
  questions: Question[];
  attempts: QuizAttempt[];
  focusTopics?: string[];
}

export interface SrsState {
  ease: number;
  interval: number; // days
  reps: number;
  lapses: number;
  due: number; // epoch ms
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  tag: string;
  srs: SrsState;
}

export interface Deck {
  id: string;
  title: string;
  fileName: string;
  createdAt: number;
  text: string;
  slideCount: number;
  language: Language;
  notes?: string;
  mindmap?: string;
  flashcards: Flashcard[];
  quizzes: Quiz[];
}

/* ---- API contract between the browser and /api/generate ---- */

export type GenerateRequest =
  | { kind: "notes"; title: string; text: string; language: Language }
  | { kind: "mindmap"; title: string; text: string; language: Language }
  | { kind: "flashcards"; title: string; text: string; language: Language; count: number }
  | {
      kind: "quiz";
      title: string;
      text: string;
      language: Language;
      count: number;
      format: ExamFormatId;
      /** Topics the student is weak on — the quiz concentrates on these. */
      focusTopics?: string[];
    }
  | { kind: "casereport"; language: Language; details: CaseDetails };

export type GenerateResponse =
  | { kind: "notes"; markdown: string }
  | { kind: "mindmap"; markdown: string }
  | { kind: "flashcards"; cards: { front: string; back: string; tag: string }[] }
  | { kind: "quiz"; questions: Question[] }
  | { kind: "casereport"; result: CaseReportResult };

/* ---- Case reports ---- */

export interface CaseDetails {
  workingTitle: string;
  patient: string;
  presentation: string;
  history: string;
  examination: string;
  investigations: string;
  diagnosis: string;
  treatment: string;
  outcome: string;
  novelty: string;
  patientPerspective: string;
  targetJournal: string;
  wordLimit: number;
  consentObtained: boolean;
}

export interface CaseReportResult {
  titleOptions: string[];
  draft: string;
  checklistGaps: string[];
  pubmedQueries: string[];
}

export interface CaseReport {
  id: string;
  createdAt: number;
  updatedAt: number;
  details: CaseDetails;
  language: Language;
  result?: CaseReportResult;
}
