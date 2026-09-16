import type { FieldMapping } from "./application";

// AI outputs are persisted to MongoDB rather than Postgres because each kind has
// a different shape (a cover letter is a blob, a question answer carries its
// input constraints, a field mapping is an array of scored fields). A
// discriminated union maps cleanly onto documents; in SQL it would be a wide
// sparse table or a jsonb column that RLS can't reason about anyway.

export type GenerationKind = "cover_letter" | "question_answer" | "field_mapping";
export type GenerationSource = "web" | "extension";

export interface GenerationJobRef {
  id?: string;
  title?: string;
  company?: string;
  url?: string;
}

interface GenerationBase {
  userId: string;
  source: GenerationSource;
  /** Model the caller asked for. The fallback chain may have served another. */
  model: string;
  job: GenerationJobRef;
  durationMs?: number;
  createdAt: Date;
}

export interface CoverLetterGeneration extends GenerationBase {
  kind: "cover_letter";
  output: { coverLetter: string };
}

export interface QuestionAnswerGeneration extends GenerationBase {
  kind: "question_answer";
  input: {
    question: string;
    type: string;
    options?: string[];
    maxLength?: number | null;
    minLength?: number | null;
    required?: boolean;
    isCoverLetter?: boolean;
  };
  output: {
    rewrittenQuestion: string;
    answer: string;
    confidence: "high" | "medium" | "low";
  };
}

export interface FieldMappingGeneration extends GenerationBase {
  kind: "field_mapping";
  output: {
    mappings: FieldMapping[];
    lowConfidenceCount: number;
  };
}

export type Generation =
  | CoverLetterGeneration
  | QuestionAnswerGeneration
  | FieldMappingGeneration;

/** What the data layer accepts — createdAt is stamped on insert. */
export type NewGeneration = Generation extends infer G
  ? G extends Generation
    ? Omit<G, "createdAt">
    : never
  : never;

/** What the API returns — `_id` becomes a string `id`, dates are ISO strings. */
export type GenerationRecord = Generation extends infer G
  ? G extends Generation
    ? Omit<G, "createdAt"> & { id: string; createdAt: string }
    : never
  : never;

export interface GenerationUsage {
  since: string;
  total: number;
  byKind: Record<GenerationKind, number>;
  byModel: Record<string, number>;
}
