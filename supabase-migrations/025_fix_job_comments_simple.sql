-- Simplify job_comments to work with current database structure
-- Remove complex RLS policy that references non-existent tables
-- Validation will be handled in application code

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can view comments" ON job_comments;
DROP POLICY IF EXISTS "Authenticated users can insert comments" ON job_comments;
DROP POLICY IF EXISTS "Token holders can insert comments" ON job_comments;
DROP POLICY IF EXISTS "Users can update their own comments" ON job_comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON job_comments;

-- Create simple RLS policies (validation handled in app)
CREATE POLICY "Anyone can view comments"
  ON job_comments FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert comments"
  ON job_comments FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update their own comments"
  ON job_comments FOR UPDATE
  USING (wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address');

CREATE POLICY "Users can delete their own comments"
  ON job_comments FOR DELETE
  USING (wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address');

COMMENT ON TABLE job_comments IS 'Comments on job postings - token holder verification done in application layer';


