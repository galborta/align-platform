-- Migration: Create admin activity logs table
-- Created: 2024-11-22
-- Description: Tracks all admin actions for audit trail

-- Create admin_logs table
CREATE TABLE IF NOT EXISTS admin_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_wallet TEXT NOT NULL,
  action TEXT NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  entity_type TEXT, -- 'project', 'asset', 'message', 'karma', 'vote'
  entity_id TEXT,
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_admin_logs_project ON admin_logs(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_logs_admin ON admin_logs(admin_wallet, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_logs_action ON admin_logs(action, created_at DESC);

-- Enable RLS
ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can read all logs" ON admin_logs;
DROP POLICY IF EXISTS "Admins can insert logs" ON admin_logs;

-- Allow admins to read all logs (validation in app layer)
CREATE POLICY "Admins can read all logs" ON admin_logs
  FOR SELECT USING (true);

-- Allow admins to insert logs
CREATE POLICY "Admins can insert logs" ON admin_logs
  FOR INSERT WITH CHECK (true);

