-- Migration: Add editor_wallets column to projects table
-- Created: 2024-12-19
-- Purpose: Store array of wallet addresses that can edit project information
-- Sprint 1: Database Foundation - Project Editors System

-- ============================================
-- ADD EDITOR_WALLETS COLUMN
-- ============================================

-- Add editor_wallets column to projects table
ALTER TABLE projects 
  ADD COLUMN IF NOT EXISTS editor_wallets text[] DEFAULT ARRAY[]::text[];

-- ============================================
-- ADD INDEX FOR PERFORMANCE
-- ============================================

-- Add GIN index for fast array containment queries
-- This enables efficient "WHERE wallet_address = ANY(editor_wallets)" queries
CREATE INDEX IF NOT EXISTS idx_projects_editor_wallets 
  ON projects USING GIN (editor_wallets);

-- ============================================
-- DOCUMENTATION
-- ============================================

-- Add comment for documentation
COMMENT ON COLUMN projects.editor_wallets IS 
  'Array of wallet addresses authorized to edit project info and manage social assets. Creator is always implicitly included.';

-- ============================================
-- ROLLBACK (for reference only)
-- ============================================

-- To rollback this migration, run:
-- ALTER TABLE projects DROP COLUMN IF EXISTS editor_wallets;
-- DROP INDEX IF EXISTS idx_projects_editor_wallets;

