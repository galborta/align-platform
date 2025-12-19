-- Add reason column to blocked_users table
-- Migration: 015_add_block_reason.sql

-- Add reason column (optional text field for moderation/audit)
ALTER TABLE blocked_users 
ADD COLUMN IF NOT EXISTS reason TEXT;

-- Add deleted_at column to messages for soft deletion
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Create index for soft-deleted messages
CREATE INDEX IF NOT EXISTS idx_messages_deleted ON messages(conversation_id, deleted_at) WHERE deleted_at IS NOT NULL;

-- Comment on columns
COMMENT ON COLUMN blocked_users.reason IS 'Optional reason for blocking (moderation/audit)';
COMMENT ON COLUMN messages.deleted_at IS 'Soft delete timestamp when conversation is deleted';


















