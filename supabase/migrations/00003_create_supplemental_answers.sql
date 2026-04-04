CREATE TABLE supplemental_answers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_key text NOT NULL,
  question_label text NOT NULL,
  answer text NOT NULL,
  source supplemental_source DEFAULT 'manual',
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, question_key)
);
