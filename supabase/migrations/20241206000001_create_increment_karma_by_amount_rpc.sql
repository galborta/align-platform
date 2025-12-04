-- Migration: Create increment_karma_field_by_amount RPC
-- Created: 2024-12-06
-- Description: RPC function to increment karma fields by a specific amount
--              Used for tracking tokens_earned and other numeric karma fields

-- ==================== RPC FUNCTION ====================

CREATE OR REPLACE FUNCTION increment_karma_field_by_amount(
  p_wallet_address TEXT,
  p_field_name TEXT,
  p_amount NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validate field name to prevent SQL injection
  IF p_field_name NOT IN (
    'total_karma_points',
    'tokens_earned',
    'tips_sent_count',
    'tips_received_count',
    'tip_karma_earned_today',
    'assets_added_count',
    'upvotes_given_count',
    'reports_given_count',
    'warning_count',
    'jobs_completed_as_worker_count',
    'applications_submitted_count',
    'jobs_posted_as_poster_count',
    'contest_votes_cast_count',
    'contest_votes_won_count',
    'dispute_votes_cast_count',
    'dispute_votes_won_count'
  ) THEN
    RAISE EXCEPTION 'Invalid field name: %', p_field_name;
  END IF;

  -- Ensure wallet_karma record exists
  INSERT INTO wallet_karma (wallet_address, project_id, created_at)
  VALUES (p_wallet_address, NULL, NOW())
  ON CONFLICT (wallet_address, project_id) DO NOTHING;

  -- Increment the specified field by the given amount
  EXECUTE format(
    'UPDATE wallet_karma SET %I = COALESCE(%I, 0) + $1, updated_at = NOW() WHERE wallet_address = $2',
    p_field_name, p_field_name
  ) USING p_amount, p_wallet_address;
END;
$$;

-- Add comment
COMMENT ON FUNCTION increment_karma_field_by_amount(TEXT, TEXT, NUMERIC) IS 
  'Increments a karma field by a specific amount. Used for tokens_earned and other numeric tracking fields.';

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION increment_karma_field_by_amount(TEXT, TEXT, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_karma_field_by_amount(TEXT, TEXT, NUMERIC) TO service_role;

-- ==================== ALSO CREATE PROJECT-SCOPED VERSION ====================

CREATE OR REPLACE FUNCTION increment_karma_field_by_amount_for_project(
  p_wallet_address TEXT,
  p_project_id UUID,
  p_field_name TEXT,
  p_amount NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validate field name to prevent SQL injection
  IF p_field_name NOT IN (
    'total_karma_points',
    'tokens_earned',
    'tips_sent_count',
    'tips_received_count',
    'tip_karma_earned_today',
    'assets_added_count',
    'upvotes_given_count',
    'reports_given_count',
    'warning_count',
    'jobs_completed_as_worker_count',
    'applications_submitted_count',
    'jobs_posted_as_poster_count',
    'contest_votes_cast_count',
    'contest_votes_won_count',
    'dispute_votes_cast_count',
    'dispute_votes_won_count'
  ) THEN
    RAISE EXCEPTION 'Invalid field name: %', p_field_name;
  END IF;

  -- Ensure wallet_karma record exists for this project
  INSERT INTO wallet_karma (wallet_address, project_id, created_at)
  VALUES (p_wallet_address, p_project_id, NOW())
  ON CONFLICT (wallet_address, project_id) DO NOTHING;

  -- Increment the specified field by the given amount
  EXECUTE format(
    'UPDATE wallet_karma SET %I = COALESCE(%I, 0) + $1, updated_at = NOW() WHERE wallet_address = $2 AND project_id = $3',
    p_field_name, p_field_name
  ) USING p_amount, p_wallet_address, p_project_id;
END;
$$;

-- Add comment
COMMENT ON FUNCTION increment_karma_field_by_amount_for_project(TEXT, UUID, TEXT, NUMERIC) IS 
  'Increments a karma field by a specific amount for a specific project. Used for project-scoped karma tracking.';

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION increment_karma_field_by_amount_for_project(TEXT, UUID, TEXT, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_karma_field_by_amount_for_project(TEXT, UUID, TEXT, NUMERIC) TO service_role;

