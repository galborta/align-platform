-- Add winner tracking fields to job_submissions table

ALTER TABLE job_submissions ADD COLUMN is_selected_winner BOOLEAN DEFAULT FALSE;

ALTER TABLE job_submissions ADD COLUMN winner_position INTEGER;

ALTER TABLE job_submissions ADD COLUMN prize_amount_tokens NUMERIC(20,8);

ALTER TABLE job_submissions ADD COLUMN prize_amount_usd NUMERIC(20,2);

-- Add index for faster winner queries
CREATE INDEX idx_job_submissions_winners ON job_submissions(job_id, is_selected_winner) 
  WHERE is_selected_winner = TRUE;

-- Add helpful comments
COMMENT ON COLUMN job_submissions.is_selected_winner IS 'Whether this submission was selected as a contest winner';
COMMENT ON COLUMN job_submissions.winner_position IS 'Contest position (1=first, 2=second, 3=third, etc.)';

