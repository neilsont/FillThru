CREATE TABLE flagged_questions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id uuid REFERENCES jobs(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  field_key text NOT NULL,
  resolved boolean DEFAULT false,
  answer text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_flagged_unresolved ON flagged_questions(user_id, resolved) WHERE resolved = false;
