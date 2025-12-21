-- Migration: Add notification types for editor events
-- Created: 2024-12-19
-- Purpose: Support notifications for editor lifecycle and actions
-- Sprint 1: Database Foundation - Project Editors System

-- ============================================
-- DOCUMENTATION UPDATE
-- ============================================

-- Note: notification_type is defined in types/database.ts as a TypeScript union type
-- We track the new types here and update the TypeScript definition separately

-- Add comments documenting new notification types
-- (Actual notification records created by application code)

COMMENT ON TABLE notifications IS 
  'Notification system for user alerts. 
   
   New editor-related types (as of Sprint 1 - Project Editors):
   - editor_added: When user is added as project editor
   - editor_removed: When user is removed as project editor
   - social_asset_pending: When social asset submitted for editor review
   - social_asset_approved: When editor approves submitted asset
   - social_asset_rejected: When editor rejects submitted asset
   
   See types/database.ts NotificationType for complete list of all notification types.
   Metadata fields for editor notifications stored in notifications.metadata JSONB column.';

-- ============================================
-- VERIFICATION
-- ============================================

-- Verify notifications table can handle new metadata fields
-- Check that metadata jsonb column exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
      AND table_name = 'notifications' 
      AND column_name = 'metadata'
      AND data_type = 'jsonb'
  ) THEN
    RAISE EXCEPTION 'notifications.metadata column missing or wrong type - required for editor notifications';
  END IF;
  
  RAISE NOTICE 'Verification passed: notifications.metadata column exists and is JSONB type';
END $$;

-- ============================================
-- MIGRATION NOTES
-- ============================================

-- This migration serves as a documentation checkpoint for new notification types.
-- No structural changes needed - notification types are enforced in TypeScript.

-- TypeScript changes required in types/database.ts:
-- 1. Add new types to NotificationType union:
--    - 'editor_added'
--    - 'editor_removed'
--    - 'social_asset_pending'
--    - 'social_asset_approved'
--    - 'social_asset_rejected'
--
-- 2. Add new fields to NotificationMetadata interface:
--    - editor_wallet?: string
--    - asset_id?: string
--    - asset_type?: string
--    - rejection_reason?: string
--    - project_name?: string

-- ============================================
-- ROLLBACK (for reference only)
-- ============================================

-- To rollback this migration, run:
-- COMMENT ON TABLE notifications IS 'Notification system for user alerts. See types/database.ts for all notification types.';

