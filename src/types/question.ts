export interface FlaggedQuestionWithJob {
  id: string;
  job_id: string | null;
  question_text: string;
  field_key: string | null;
  resolved: boolean;
  answer: string | null;
  created_at: string;
  updated_at?: string;
  ids?: string[];
  duplicate_count?: number;
  actionable?: boolean;
  existing_answer?: string | null;
  job?: {
    id: string;
    title: string;
    company: string;
  } | null;
}
