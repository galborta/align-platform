-- Migration: Document editor-related admin log actions
-- Created: 2024-12-19
-- Purpose: Ensure admin_logs table supports editor management tracking
-- Sprint 1: Database Foundation - Project Editors System

-- ============================================
-- VERIFICATION
-- ============================================

-- Verify admin_logs structure supports editor actions
DO $$
BEGIN
  -- Check action column exists (stores action type as text)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'admin_logs'
      AND column_name = 'action'
      AND data_type = 'text'
  ) THEN
    RAISE EXCEPTION 'admin_logs.action column missing or wrong type';
  END IF;

  -- Check details column exists (stores action metadata as jsonb)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'admin_logs'
      AND column_name = 'details'
      AND data_type = 'jsonb'
  ) THEN
    RAISE EXCEPTION 'admin_logs.details column missing or wrong type';
  END IF;
  
  -- Check project_id column exists (for filtering logs by project)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'admin_logs'
      AND column_name = 'project_id'
  ) THEN
    RAISE EXCEPTION 'admin_logs.project_id column missing';
  END IF;
  
  RAISE NOTICE 'Verification passed: admin_logs table structure supports editor actions';
END $$;

-- ============================================
-- DOCUMENTATION
-- ============================================

-- Document new action types for editor management
COMMENT ON COLUMN admin_logs.action IS 
  'Action type identifier for admin/editor operations.
   
   Editor-related actions (as of Sprint 1 - Project Editors):
   - editor_added: Admin or creator added editor to project
   - editor_removed: Admin or creator removed editor from project
   - project_edited: Editor modified project information
   - social_asset_approved: Editor approved pending social asset
   - social_asset_rejected: Editor rejected pending social asset
   
   Details JSONB column contains action-specific metadata:
   - editor_wallet: Wallet address of editor being added/removed
   - added_by: Wallet address of user who added the editor
   - removed_by: Wallet address of user who removed the editor
   - asset_id: ID of social asset that was approved/rejected
   - changes: Object describing what was modified in project
   - reason: Optional reason for rejection or removal
   
   See lib/admin-logs.ts for complete action type list and usage examples.';

COMMENT ON COLUMN admin_logs.details IS
  'JSONB object containing action-specific metadata. Structure varies by action type.
   
   For editor actions, common fields include:
   - editor_wallet (string): Wallet being added/removed as editor
   - added_by/removed_by (string): Wallet performing the action
   - asset_id (string): Social asset ID for approval/rejection
   - changes (object): Modified fields for project edits
   - reason (string): Optional explanation for action';

-- ============================================
-- PERFORMANCE INDEXES
-- ============================================

-- Add index on action type if not exists (for filtering logs by action)
CREATE INDEX IF NOT EXISTS idx_admin_logs_action 
  ON admin_logs(action);

-- Add composite index for project-specific action queries
-- Enables fast filtering like: WHERE project_id = X AND action = Y
CREATE INDEX IF NOT EXISTS idx_admin_logs_project_action 
  ON admin_logs(project_id, action);

-- Add index on created_at for time-based queries
CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at
  ON admin_logs(created_at DESC);

-- ============================================
-- MIGRATION NOTES
-- ============================================

-- This migration is documentation-only with performance optimization.
-- No schema changes needed - action types are application-level strings.
-- 
-- Application code should log editor actions using:
--   await logAdminAction({
--     action: 'editor_added',
--     admin_wallet: currentUser,
--     project_id: projectId,
--     details: {
--       editor_wallet: newEditorWallet,
--       added_by: currentUser
--     }
--   })

-- ============================================
-- ROLLBACK (for reference only)
-- ============================================

-- To rollback this migration, run:
-- DROP INDEX IF EXISTS idx_admin_logs_created_at;
-- DROP INDEX IF EXISTS idx_admin_logs_project_action;
-- DROP INDEX IF EXISTS idx_admin_logs_action;
-- COMMENT ON COLUMN admin_logs.action IS 'Action type identifier';
-- COMMENT ON COLUMN admin_logs.details IS 'JSONB object containing action-specific metadata';

