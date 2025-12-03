-- Migration: Add job_submissions to realtime publication
-- Created: December 2024
-- Description: Enable real-time updates for contest submission gallery
-- Status: APPLIED via Supabase MCP

-- Add job_submissions to realtime publication for live updates
-- This enables real-time subscription for:
-- - New submissions appearing instantly in gallery
-- - Winner selection updates propagating live
ALTER PUBLICATION supabase_realtime ADD TABLE job_submissions;

-- ==================== VERIFICATION ====================
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 039_add_job_submissions_realtime completed!';
  RAISE NOTICE '📡 job_submissions table now has real-time enabled';
  RAISE NOTICE '🔴 Live updates available for:';
  RAISE NOTICE '   - INSERT: New submissions appear instantly';
  RAISE NOTICE '   - UPDATE: Winner selection updates live';
END $$;

