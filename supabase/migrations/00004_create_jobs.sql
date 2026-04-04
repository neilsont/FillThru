CREATE TABLE jobs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  company text NOT NULL,
  location text,
  job_type text,
  description text,
  url text,
  source job_source DEFAULT 'manual',
  status job_status DEFAULT 'discovered',
  match_score integer,
  logo_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_jobs_user_status ON jobs(user_id, status);
