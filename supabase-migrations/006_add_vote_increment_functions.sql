-- Migration: Add RPC functions for vote increment
-- Created: 2024-11-20
-- Description: Adds increment_upvote and increment_report RPC functions for atomic vote updates

-- Function to increment upvote totals
CREATE OR REPLACE FUNCTION increment_upvote(
  p_asset_id UUID,
  p_weight NUMERIC
) RETURNS void AS $$
BEGIN
  UPDATE pending_assets
  SET 
    total_upvote_weight = total_upvote_weight + p_weight,
    unique_upvoters_count = unique_upvoters_count + 1,
    updated_at = NOW()
  WHERE id = p_asset_id;
END;
$$ LANGUAGE plpgsql;

-- Function to increment report totals
CREATE OR REPLACE FUNCTION increment_report(
  p_asset_id UUID,
  p_weight NUMERIC
) RETURNS void AS $$
BEGIN
  UPDATE pending_assets
  SET 
    total_report_weight = total_report_weight + p_weight,
    unique_reporters_count = unique_reporters_count + 1,
    updated_at = NOW()
  WHERE id = p_asset_id;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION increment_upvote(UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_report(UUID, NUMERIC) TO authenticated;

