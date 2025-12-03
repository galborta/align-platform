-- Add contest-specific fields to jobs table

ALTER TABLE jobs ADD COLUMN is_contest BOOLEAN DEFAULT FALSE;

ALTER TABLE jobs ADD COLUMN contest_max_winners INTEGER;

ALTER TABLE jobs ADD COLUMN contest_winner_prizes JSONB;

ALTER TABLE jobs ADD COLUMN contest_submission_deadline TIMESTAMPTZ;

ALTER TABLE jobs ADD COLUMN contest_winner_selection_deadline TIMESTAMPTZ;

ALTER TABLE jobs ADD COLUMN contest_submissions_visible BOOLEAN DEFAULT TRUE;

ALTER TABLE jobs ADD COLUMN contest_winners_selected_at TIMESTAMPTZ;

-- Add check constraint to ensure contest jobs have required fields
ALTER TABLE jobs ADD CONSTRAINT check_contest_fields 
  CHECK (
    (is_contest = FALSE) OR 
    (is_contest = TRUE AND contest_max_winners >= 1 AND contest_winner_prizes IS NOT NULL)
  );

-- Add helpful comments
COMMENT ON COLUMN jobs.is_contest IS 'Whether this job is a contest (multiple submissions, manual winner selection)';
COMMENT ON COLUMN jobs.contest_winner_prizes IS 'Array of {position: number, amount_tokens: number, amount_usd: number} for each winner';

