export interface FlaggedQuestionWithJob {
  id: string;
  job_id: string | null;
  question_text: string;
  field_key: string;
  resolved: boolean;
  answer: string | null;
  created_at: string;
  job?: {
    id: string;
    title: string;
    company: string;
  } | null;
}
