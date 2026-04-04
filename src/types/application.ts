export interface FieldMapping {
  field_key: string;
  field_label: string;
  value: string;
  confidence: number;
  source: "resume" | "supplemental" | "ai_inferred" | "manual";
}

export interface ApplicationWithJob {
  id: string;
  job_id: string;
  cover_letter: string | null;
  filled_fields: FieldMapping[];
  status: "draft" | "ready" | "submitted" | "withdrawn";
  approved_at: string | null;
  submitted_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  job: {
    id: string;
    title: string;
    company: string;
    location: string | null;
    job_type: string | null;
    description: string | null;
    url: string | null;
    match_score: number | null;
    status: string;
  };
}
