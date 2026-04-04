-- Enable RLS on all tables
ALTER TABLE resume_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplemental_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE flagged_questions ENABLE ROW LEVEL SECURITY;

-- resume_data policies
CREATE POLICY "Users can view own resume_data" ON resume_data FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own resume_data" ON resume_data FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own resume_data" ON resume_data FOR UPDATE USING (auth.uid() = user_id);

-- supplemental_answers policies
CREATE POLICY "Users can view own supplemental_answers" ON supplemental_answers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own supplemental_answers" ON supplemental_answers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own supplemental_answers" ON supplemental_answers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own supplemental_answers" ON supplemental_answers FOR DELETE USING (auth.uid() = user_id);

-- jobs policies
CREATE POLICY "Users can view own jobs" ON jobs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own jobs" ON jobs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own jobs" ON jobs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own jobs" ON jobs FOR DELETE USING (auth.uid() = user_id);

-- applications policies
CREATE POLICY "Users can view own applications" ON applications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own applications" ON applications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own applications" ON applications FOR UPDATE USING (auth.uid() = user_id);

-- flagged_questions policies
CREATE POLICY "Users can view own flagged_questions" ON flagged_questions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own flagged_questions" ON flagged_questions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own flagged_questions" ON flagged_questions FOR UPDATE USING (auth.uid() = user_id);

-- Storage policies for resumes bucket
CREATE POLICY "Users can upload own resumes" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can read own resumes" ON storage.objects FOR SELECT
  USING (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can update own resumes" ON storage.objects FOR UPDATE
  USING (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text);
