export type SupplementalSource = "manual" | "ai_suggested" | "imported";
export type JobSource = "manual" | "indeed" | "linkedin" | "other";
export type JobStatus = "discovered" | "in_progress" | "applied" | "interviewing" | "rejected" | "offer";
export type ApplicationStatus = "draft" | "ready" | "submitted" | "withdrawn";

export interface ResumeData {
  id: string;
  user_id: string;
  raw_text: string | null;
  parsed_json: Record<string, unknown> | null;
  file_path: string | null;
  updated_at: string;
}

export interface SupplementalAnswer {
  id: string;
  user_id: string;
  question_key: string;
  question_label: string;
  answer: string;
  source: SupplementalSource;
  created_at: string;
}

export interface Job {
  id: string;
  user_id: string;
  title: string;
  company: string;
  location: string | null;
  job_type: string | null;
  description: string | null;
  url: string | null;
  source: JobSource;
  status: JobStatus;
  match_score: number | null;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Application {
  id: string;
  user_id: string;
  job_id: string;
  cover_letter: string | null;
  filled_fields_json: Record<string, unknown> | null;
  status: ApplicationStatus;
  approved_at: string | null;
  submitted_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface FlaggedQuestion {
  id: string;
  user_id: string;
  job_id: string | null;
  question_text: string;
  field_key: string;
  resolved: boolean;
  answer: string | null;
  created_at: string;
  updated_at: string;
}

export interface Database {
  public: {
    Tables: {
      resume_data: { Row: ResumeData; Insert: Partial<ResumeData> & { user_id: string }; Update: Partial<ResumeData> };
      supplemental_answers: { Row: SupplementalAnswer; Insert: Partial<SupplementalAnswer> & { user_id: string; question_key: string; question_label: string; answer: string }; Update: Partial<SupplementalAnswer> };
      jobs: { Row: Job; Insert: Partial<Job> & { user_id: string; title: string; company: string }; Update: Partial<Job> };
      applications: { Row: Application; Insert: Partial<Application> & { user_id: string; job_id: string }; Update: Partial<Application> };
      flagged_questions: { Row: FlaggedQuestion; Insert: Partial<FlaggedQuestion> & { user_id: string; question_text: string; field_key: string }; Update: Partial<FlaggedQuestion> };
    };
  };
}
