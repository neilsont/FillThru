CREATE TABLE resume_data (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  raw_text text,
  parsed_json jsonb,
  file_path text,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);
