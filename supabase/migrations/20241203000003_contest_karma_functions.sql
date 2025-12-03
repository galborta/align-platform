-- =====================================================
-- Contest Karma System
-- Migration: Add contest wins tracking and karma awards
-- =====================================================

-- Add contest_wins_count column to wallet_karma table
ALTER TABLE wallet_karma 
ADD COLUMN IF NOT EXISTS contest_wins_count INTEGER DEFAULT 0;

-- Create index for efficient leaderboard queries
CREATE INDEX IF NOT EXISTS idx_wallet_karma_contest_wins 
ON wallet_karma(project_id, contest_wins_count DESC);

-- =====================================================
-- Function: award_contest_winner_karma
-- Awards karma to contest winners based on their position
-- 
-- Karma amounts by position:
--   1st place: +100 karma
--   2nd place: +75 karma
--   3rd place: +50 karma
--   4th-10th:  +25 karma
--
-- Also increments:
--   - jobs_completed_as_worker_count (all winners)
--   - contest_wins_count (all winners)
-- =====================================================

CREATE OR REPLACE FUNCTION award_contest_winner_karma(
  p_wallet TEXT,
  p_project UUID,
  p_position INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_karma_amount INTEGER;
BEGIN
  -- Validate inputs
  IF p_wallet IS NULL OR p_wallet = '' THEN
    RAISE EXCEPTION 'Wallet address is required';
  END IF;
  
  IF p_project IS NULL THEN
    RAISE EXCEPTION 'Project ID is required';
  END IF;
  
  IF p_position IS NULL OR p_position < 1 THEN
    RAISE EXCEPTION 'Position must be a positive integer';
  END IF;

  -- Calculate karma based on position
  IF p_position = 1 THEN
    v_karma_amount := 100;
  ELSIF p_position = 2 THEN
    v_karma_amount := 75;
  ELSIF p_position = 3 THEN
    v_karma_amount := 50;
  ELSE
    -- 4th place and beyond
    v_karma_amount := 25;
  END IF;

  -- Upsert wallet_karma record
  -- Insert new record or update existing one
  INSERT INTO wallet_karma (
    wallet_address, 
    project_id, 
    total_karma_points, 
    jobs_completed_as_worker_count, 
    contest_wins_count,
    created_at,
    updated_at
  )
  VALUES (
    p_wallet, 
    p_project, 
    v_karma_amount, 
    1, 
    1,
    NOW(),
    NOW()
  )
  ON CONFLICT (wallet_address, project_id)
  DO UPDATE SET
    total_karma_points = wallet_karma.total_karma_points + v_karma_amount,
    jobs_completed_as_worker_count = wallet_karma.jobs_completed_as_worker_count + 1,
    contest_wins_count = wallet_karma.contest_wins_count + 1,
    updated_at = NOW();
    
  -- Log the karma award for debugging
  RAISE NOTICE 'Awarded % karma to wallet % for position % in project %', 
    v_karma_amount, p_wallet, p_position, p_project;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION award_contest_winner_karma(TEXT, UUID, INTEGER) TO authenticated;

-- =====================================================
-- Function: get_contest_winners_leaderboard
-- Returns top contest winners for a project
-- =====================================================

CREATE OR REPLACE FUNCTION get_contest_winners_leaderboard(
  p_project_id UUID,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  wallet_address TEXT,
  contest_wins_count INTEGER,
  total_karma_points NUMERIC,
  jobs_completed_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    wk.wallet_address,
    wk.contest_wins_count,
    wk.total_karma_points,
    wk.jobs_completed_as_worker_count
  FROM wallet_karma wk
  WHERE wk.project_id = p_project_id
    AND wk.contest_wins_count > 0
  ORDER BY wk.contest_wins_count DESC, wk.total_karma_points DESC
  LIMIT p_limit;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_contest_winners_leaderboard(UUID, INTEGER) TO authenticated;

-- =====================================================
-- Add comment for documentation
-- =====================================================

COMMENT ON COLUMN wallet_karma.contest_wins_count IS 
  'Number of contest wins (any position 1st through 10th)';

COMMENT ON FUNCTION award_contest_winner_karma IS 
  'Awards karma to contest winners: 1st=100, 2nd=75, 3rd=50, 4th+=25. Also increments win counts.';

