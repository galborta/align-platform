-- Migration: Add conversation archive functionality
-- Purpose: Allow users to archive (hide) conversations without deleting them
-- Each participant can independently archive their view of the conversation
-- Messages are preserved and conversations can be restored later

-- Add archive fields to conversations table
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS archived_by_participant_1 BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS archived_by_participant_2 BOOLEAN DEFAULT FALSE;

-- Add indexes for archived conversations (improves query performance)
CREATE INDEX IF NOT EXISTS idx_conversations_archived 
ON conversations(participant_1, archived_by_participant_1);

CREATE INDEX IF NOT EXISTS idx_conversations_archived_p2 
ON conversations(participant_2, archived_by_participant_2);

-- Add comments for documentation
COMMENT ON COLUMN conversations.archived_by_participant_1 IS 'Whether participant_1 has archived this conversation';
COMMENT ON COLUMN conversations.archived_by_participant_2 IS 'Whether participant_2 has archived this conversation';

-- Benefits:
-- 1. Conversations are never permanently deleted
-- 2. Each user can independently archive/restore
-- 3. Messages are preserved for debugging/support
-- 4. Better user experience with reversible actions















