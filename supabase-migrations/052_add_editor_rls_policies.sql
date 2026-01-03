-- Migration: Add RLS policies for editor access
-- Created: 2024-12-19
-- Purpose: Allow editors to view and update projects they're assigned to
-- Sprint 1: Database Foundation - Project Editors System

-- ============================================
-- ENABLE RLS ON PROJECTS TABLE
-- ============================================

-- Ensure RLS is enabled on projects table
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- ============================================
-- DROP EXISTING POLICIES (if any)
-- ============================================

-- Drop any existing policies to avoid conflicts
DROP POLICY IF EXISTS "Public can view live projects" ON projects;
DROP POLICY IF EXISTS "Anyone can view projects" ON projects;
DROP POLICY IF EXISTS "Editors can view their projects" ON projects;
DROP POLICY IF EXISTS "Creators can update their projects" ON projects;
DROP POLICY IF EXISTS "Editors can update their projects" ON projects;
DROP POLICY IF EXISTS "Only creator can modify editor_wallets" ON projects;
DROP POLICY IF EXISTS "Editors can update pending assets for their projects" ON pending_assets;

-- ============================================
-- HELPER FUNCTION
-- ============================================

-- Function: Check if wallet is project creator or in editor_wallets array
CREATE OR REPLACE FUNCTION is_project_editor_or_creator(
  p_project_id uuid,
  p_wallet_address text
) RETURNS boolean AS $$
DECLARE
  v_creator_wallet text;
  v_editor_wallets text[];
BEGIN
  SELECT creator_wallet, editor_wallets
  INTO v_creator_wallet, v_editor_wallets
  FROM projects
  WHERE id = p_project_id;
  
  -- Return true if creator or in editors array
  RETURN (
    v_creator_wallet = p_wallet_address 
    OR p_wallet_address = ANY(v_editor_wallets)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION is_project_editor_or_creator IS
  'Check if wallet is project creator or in editor_wallets array. Returns true if user has editor or creator access to project.';

-- ============================================
-- PROJECTS TABLE RLS POLICIES
-- ============================================

-- Policy 1: Public can view live projects
CREATE POLICY "Public can view live projects"
  ON projects
  FOR SELECT
  USING (status = 'live');

-- Policy 2: Editors can view their projects (any status)
CREATE POLICY "Editors can view their projects"
  ON projects
  FOR SELECT
  USING (
    -- Creator can always view
    creator_wallet = current_setting('request.jwt.claims', true)::json->>'wallet_address'
    OR
    -- Editors can view if their wallet is in editor_wallets array
    current_setting('request.jwt.claims', true)::json->>'wallet_address' = ANY(editor_wallets)
  );

-- Policy 3: Editors can update their projects (with session validation)
-- NOTE: Application code validates which fields can be modified
CREATE POLICY "Editors can update their projects"
  ON projects
  FOR UPDATE
  USING (
    -- Creator can always update
    creator_wallet = current_setting('request.jwt.claims', true)::json->>'wallet_address'
    OR
    -- Editors can update if:
    -- 1. Their wallet is in editor_wallets array
    -- 2. They have a valid active session (prevents unauthorized access)
    (current_setting('request.jwt.claims', true)::json->>'wallet_address' = ANY(editor_wallets)
     AND is_valid_editor_session(
       id,
       current_setting('request.jwt.claims', true)::json->>'wallet_address'
     ))
  )
  WITH CHECK (
    -- Ensure editor_wallets column is not being modified by editors
    -- Only creator can modify the editor list
    CASE 
      WHEN creator_wallet = current_setting('request.jwt.claims', true)::json->>'wallet_address' THEN true
      ELSE editor_wallets = (SELECT editor_wallets FROM projects WHERE id = projects.id)
    END
  );

-- Policy 4: Only creator can insert projects
CREATE POLICY "Creators can insert projects"
  ON projects
  FOR INSERT
  WITH CHECK (
    creator_wallet = current_setting('request.jwt.claims', true)::json->>'wallet_address'
  );

-- ============================================
-- PENDING ASSETS TABLE RLS POLICIES
-- ============================================

-- Policy: Editors can update pending assets for their projects
-- This allows editors to approve/reject social assets
CREATE POLICY "Editors can update pending assets for their projects"
  ON pending_assets
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = pending_assets.project_id
      AND (
        -- Creator can update
        projects.creator_wallet = current_setting('request.jwt.claims', true)::json->>'wallet_address'
        OR
        -- Editors can update
        current_setting('request.jwt.claims', true)::json->>'wallet_address' = ANY(projects.editor_wallets)
      )
    )
  );

-- ============================================
-- SOCIAL ASSETS TABLE RLS POLICIES
-- ============================================

-- Policy: Editors can manage social assets for their projects
CREATE POLICY "Editors can manage social assets for their projects"
  ON social_assets
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = social_assets.project_id
      AND (
        -- Creator can manage
        projects.creator_wallet = current_setting('request.jwt.claims', true)::json->>'wallet_address'
        OR
        -- Editors can manage
        current_setting('request.jwt.claims', true)::json->>'wallet_address' = ANY(projects.editor_wallets)
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = social_assets.project_id
      AND (
        projects.creator_wallet = current_setting('request.jwt.claims', true)::json->>'wallet_address'
        OR
        current_setting('request.jwt.claims', true)::json->>'wallet_address' = ANY(projects.editor_wallets)
      )
    )
  );

-- ============================================
-- DOCUMENTATION
-- ============================================

COMMENT ON POLICY "Public can view live projects" ON projects IS
  'Allows anyone to view projects with status = live';

COMMENT ON POLICY "Editors can view their projects" ON projects IS
  'Allows creators and editors to view projects regardless of status';

COMMENT ON POLICY "Editors can update their projects" ON projects IS
  'Allows creators and editors with valid sessions to update projects. 
   Editors cannot modify the editor_wallets array - only creators can.
   Application code validates which specific fields editors can modify.';

COMMENT ON POLICY "Creators can insert projects" ON projects IS
  'Only the creator (wallet setting creator_wallet) can create new projects';

COMMENT ON POLICY "Editors can update pending assets for their projects" ON pending_assets IS
  'Allows project creators and editors to approve/reject pending social assets';

COMMENT ON POLICY "Editors can manage social assets for their projects" ON social_assets IS
  'Allows project creators and editors to manage verified social assets';

-- ============================================
-- MIGRATION NOTES
-- ============================================

-- This migration establishes the permission model for the editor system:
-- 
-- 1. Creators have full control over their projects
-- 2. Editors can view and update projects they're assigned to
-- 3. Editors must have valid sessions (24hr) to make updates
-- 4. Only creators can modify the editor_wallets array
-- 5. Editors can approve/reject pending assets
-- 6. Editors can manage verified social assets
--
-- Session validation prevents unauthorized access even if someone
-- manipulates the editor_wallets array in the database.

-- ============================================
-- ROLLBACK (for reference only)
-- ============================================

-- To rollback this migration, run:
-- DROP POLICY IF EXISTS "Public can view live projects" ON projects;
-- DROP POLICY IF EXISTS "Editors can view their projects" ON projects;
-- DROP POLICY IF EXISTS "Editors can update their projects" ON projects;
-- DROP POLICY IF EXISTS "Creators can insert projects" ON projects;
-- DROP POLICY IF EXISTS "Editors can update pending assets for their projects" ON pending_assets;
-- DROP POLICY IF EXISTS "Editors can manage social assets for their projects" ON social_assets;
-- DROP FUNCTION IF EXISTS is_project_editor_or_creator(uuid, text);


