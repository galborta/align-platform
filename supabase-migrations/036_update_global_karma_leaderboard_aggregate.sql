-- =====================================================
-- Update Global Karma Leaderboard to Aggregate
-- =====================================================
-- Migration: 036_update_global_karma_leaderboard_aggregate
-- Purpose: Update global_karma_leaderboard view to aggregate karma from ALL projects
--          instead of only showing entries where project_id IS NULL
-- 
-- Before: Only showed users with global karma entries (project_id IS NULL)
-- After:  Shows all users with their TOTAL karma summed from all projects
--
-- This allows users to appear on the homepage leaderboard regardless of
-- which project they earned karma in.
-- =====================================================

-- Drop existing view
DROP VIEW IF EXISTS global_karma_leaderboard CASCADE;

-- Create aggregated view that sums karma from all projects AND global entries
CREATE OR REPLACE VIEW global_karma_leaderboard AS
SELECT
  gen_random_uuid() as id,
  wk.wallet_address,
  up.display_name AS username,
  up.avatar_url,
  FLOOR(SUM(wk.total_karma_points))::INTEGER AS total_karma,
  SUM(wk.assets_added_count + wk.upvotes_given_count) AS completed_jobs,
  SUM(wk.tips_sent_count) as tips_sent_count,
  SUM(wk.tips_received_count) as tips_received_count,
  SUM(wk.assets_added_count) as assets_added_count,
  SUM(wk.upvotes_given_count) as upvotes_given_count,
  MAX(wk.updated_at) AS last_active_at,
  MIN(wk.created_at) as created_at
FROM wallet_karma wk
LEFT JOIN user_profiles up ON up.wallet_address = wk.wallet_address
WHERE wk.is_banned = false
GROUP BY wk.wallet_address, up.display_name, up.avatar_url
ORDER BY total_karma DESC;

-- Grant permissions
GRANT SELECT ON global_karma_leaderboard TO anon, authenticated;

-- Add comment
COMMENT ON VIEW global_karma_leaderboard IS 'Platform-wide karma leaderboard aggregated from all projects and global karma. Shows total karma per user summed across all their activities.';

-- =====================================================
-- Benefits of this approach:
-- =====================================================
-- 1. Users appear on global leaderboard regardless of which project they contribute to
-- 2. Total karma is sum of all project-specific karma plus any global karma
-- 3. Always up-to-date (calculated from source, not stored)
-- 4. No duplicate data to maintain
-- 5. Automatically includes new projects as users earn karma in them
--
-- Performance: View uses existing indexes on wallet_karma
-- If aggregation becomes slow with >10K users, consider:
-- - Creating a materialized view (refresh periodically)
-- - Adding a background job to maintain aggregated karma table
-- =====================================================

