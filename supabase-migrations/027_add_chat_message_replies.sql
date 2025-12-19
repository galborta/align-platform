-- Migration: Add reply functionality to chat_messages
-- Description: Add reply_to_id column to enable threaded conversations in holder chat
-- Date: 2025-11-25

-- Add reply_to_id column (nullable foreign key to same table)
ALTER TABLE chat_messages 
ADD COLUMN reply_to_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL;

-- Create index for efficient reply lookups
CREATE INDEX idx_chat_messages_reply_to ON chat_messages(reply_to_id);

-- Add comment for documentation
COMMENT ON COLUMN chat_messages.reply_to_id IS 'ID of the message being replied to (null for top-level messages)';













