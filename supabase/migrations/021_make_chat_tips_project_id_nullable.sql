-- Migration: Make project_id nullable in chat_tips
-- Description: Allow tips to be sent in direct conversations without a project context
-- Date: 2025-11-28

-- Make project_id nullable to support tips in direct conversations
ALTER TABLE chat_tips ALTER COLUMN project_id DROP NOT NULL;

-- Add index for direct conversation tips (where project_id is null)
-- This improves query performance when fetching tips between two users
CREATE INDEX IF NOT EXISTS idx_chat_tips_no_project 
  ON chat_tips(from_wallet, to_wallet, created_at DESC) 
  WHERE project_id IS NULL;

-- Update comment to reflect new behavior
COMMENT ON COLUMN chat_tips.project_id IS 'Project context for tip (null for direct conversation tips)';

-- Add comment explaining the change
COMMENT ON TABLE chat_tips IS 'Tips sent between users in chat conversations (project-specific or direct messages)';




