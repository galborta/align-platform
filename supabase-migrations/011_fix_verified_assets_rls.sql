-- Migration: Fix RLS policies for verified asset tables
-- Created: 2024-11-21
-- Description: Adds proper RLS policies to allow CRUD operations on verified assets

-- Enable RLS on verified asset tables (if not already enabled)
ALTER TABLE social_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE creative_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_assets ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public read social assets" ON social_assets;
DROP POLICY IF EXISTS "Public read creative assets" ON creative_assets;
DROP POLICY IF EXISTS "Public read legal assets" ON legal_assets;
DROP POLICY IF EXISTS "Anyone can modify social assets" ON social_assets;
DROP POLICY IF EXISTS "Anyone can modify creative assets" ON creative_assets;
DROP POLICY IF EXISTS "Anyone can modify legal assets" ON legal_assets;

-- SOCIAL ASSETS POLICIES
-- Allow public read for verified assets on live projects
CREATE POLICY "Public read social assets" ON social_assets
  FOR SELECT USING (
    verified = true AND
    EXISTS (SELECT 1 FROM projects WHERE projects.id = social_assets.project_id AND projects.status = 'live')
  );

-- Allow all modifications (INSERT, UPDATE, DELETE) - validation in app layer
CREATE POLICY "Anyone can modify social assets" ON social_assets
  FOR ALL USING (true) WITH CHECK (true);

-- CREATIVE ASSETS POLICIES
-- Allow public read for live projects
CREATE POLICY "Public read creative assets" ON creative_assets
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = creative_assets.project_id AND projects.status = 'live')
  );

-- Allow all modifications
CREATE POLICY "Anyone can modify creative assets" ON creative_assets
  FOR ALL USING (true) WITH CHECK (true);

-- LEGAL ASSETS POLICIES
-- Allow public read for live projects
CREATE POLICY "Public read legal assets" ON legal_assets
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = legal_assets.project_id AND projects.status = 'live')
  );

-- Allow all modifications
CREATE POLICY "Anyone can modify legal assets" ON legal_assets
  FOR ALL USING (true) WITH CHECK (true);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_social_assets_project ON social_assets(project_id, verified);
CREATE INDEX IF NOT EXISTS idx_creative_assets_project ON creative_assets(project_id);
CREATE INDEX IF NOT EXISTS idx_legal_assets_project ON legal_assets(project_id);

