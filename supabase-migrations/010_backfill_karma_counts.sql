-- Migration: Backfill wallet_karma counts from existing data
-- Created: 2024-11-21
-- Description: Updates assets_added_count, upvotes_given_count, and reports_given_count based on existing data

-- Backfill assets added count
UPDATE wallet_karma wk
SET assets_added_count = (
  SELECT COUNT(*)
  FROM pending_assets pa
  WHERE pa.submitter_wallet = wk.wallet_address
    AND pa.project_id = wk.project_id
),
updated_at = NOW();

-- Backfill upvotes given count
UPDATE wallet_karma wk
SET upvotes_given_count = (
  SELECT COUNT(*)
  FROM asset_votes av
  JOIN pending_assets pa ON pa.id = av.pending_asset_id
  WHERE av.voter_wallet = wk.wallet_address
    AND pa.project_id = wk.project_id
    AND av.vote_type = 'upvote'
),
updated_at = NOW();

-- Backfill reports given count
UPDATE wallet_karma wk
SET reports_given_count = (
  SELECT COUNT(*)
  FROM asset_votes av
  JOIN pending_assets pa ON pa.id = av.pending_asset_id
  WHERE av.voter_wallet = wk.wallet_address
    AND pa.project_id = wk.project_id
    AND av.vote_type = 'report'
),
updated_at = NOW();

