-- Migration: Add functions to increment vote counts in wallet_karma
-- Created: 2024-11-21
-- Description: Adds functions to track upvotes_given_count and reports_given_count

-- Function to increment upvotes given count
CREATE OR REPLACE FUNCTION increment_upvotes_given(
  p_wallet TEXT,
  p_project_id UUID
) RETURNS void AS $$
BEGIN
  -- Insert or update wallet_karma record
  INSERT INTO wallet_karma (wallet_address, project_id, upvotes_given_count)
  VALUES (p_wallet, p_project_id, 1)
  ON CONFLICT (wallet_address, project_id) 
  DO UPDATE SET 
    upvotes_given_count = wallet_karma.upvotes_given_count + 1,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to increment reports given count
CREATE OR REPLACE FUNCTION increment_reports_given(
  p_wallet TEXT,
  p_project_id UUID
) RETURNS void AS $$
BEGIN
  -- Insert or update wallet_karma record
  INSERT INTO wallet_karma (wallet_address, project_id, reports_given_count)
  VALUES (p_wallet, p_project_id, 1)
  ON CONFLICT (wallet_address, project_id) 
  DO UPDATE SET 
    reports_given_count = wallet_karma.reports_given_count + 1,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION increment_upvotes_given(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_reports_given(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_upvotes_given(TEXT, UUID) TO anon;
GRANT EXECUTE ON FUNCTION increment_reports_given(TEXT, UUID) TO anon;

