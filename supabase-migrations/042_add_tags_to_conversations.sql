-- Migration: Add tags and submission_id to conversations table
-- Created: 2024-12-14
-- Description: Adds tags array for categorizing conversations (e.g., project submissions) and links to project_submissions

-- ============================================
-- ADD COLUMNS TO CONVERSATIONS TABLE
-- ============================================

-- Add tags column (TEXT array for categorizing conversations)
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Add submission_id to link conversations with project submissions
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS submission_id UUID REFERENCES project_submissions(id) ON DELETE SET NULL;

-- ============================================
-- CREATE INDEXES
-- ============================================

-- Create GIN index for efficient array searching on tags
CREATE INDEX IF NOT EXISTS idx_conversations_tags 
  ON conversations USING GIN (tags);

-- Create index for submission_id lookups
CREATE INDEX IF NOT EXISTS idx_conversations_submission_id 
  ON conversations(submission_id);

-- ============================================
-- ADD COMMENTS
-- ============================================

COMMENT ON COLUMN conversations.tags IS 
  'Array of tags for categorizing conversations (e.g., ["project_submission", "approved", "pending"])';

COMMENT ON COLUMN conversations.submission_id IS 
  'Reference to project_submission if this conversation is related to a submission application';

COMMENT ON INDEX idx_conversations_tags IS 
  'GIN index for efficient array searching and filtering by tags';

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to update conversation tags
CREATE OR REPLACE FUNCTION update_conversation_tags(
  p_conversation_id UUID,
  p_tags TEXT[]
) RETURNS void AS $$
BEGIN
  UPDATE conversations
  SET 
    tags = p_tags, 
    updated_at = NOW()
  WHERE id = p_conversation_id;
END;
$$ LANGUAGE plpgsql;

-- Function to add a tag to a conversation (if not already present)
CREATE OR REPLACE FUNCTION add_conversation_tag(
  p_conversation_id UUID,
  p_tag TEXT
) RETURNS void AS $$
BEGIN
  UPDATE conversations
  SET 
    tags = array_append(tags, p_tag),
    updated_at = NOW()
  WHERE id = p_conversation_id
    AND NOT (p_tag = ANY(tags)); -- Only add if tag doesn't exist
END;
$$ LANGUAGE plpgsql;

-- Function to remove a tag from a conversation
CREATE OR REPLACE FUNCTION remove_conversation_tag(
  p_conversation_id UUID,
  p_tag TEXT
) RETURNS void AS $$
BEGIN
  UPDATE conversations
  SET 
    tags = array_remove(tags, p_tag),
    updated_at = NOW()
  WHERE id = p_conversation_id;
END;
$$ LANGUAGE plpgsql;

-- Function to check if conversation has a specific tag
CREATE OR REPLACE FUNCTION conversation_has_tag(
  p_conversation_id UUID,
  p_tag TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_has_tag BOOLEAN;
BEGIN
  SELECT p_tag = ANY(tags) INTO v_has_tag
  FROM conversations
  WHERE id = p_conversation_id;
  
  RETURN COALESCE(v_has_tag, false);
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

-- Grant execute permissions on tag functions
GRANT EXECUTE ON FUNCTION update_conversation_tags(UUID, TEXT[]) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION add_conversation_tag(UUID, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION remove_conversation_tag(UUID, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION conversation_has_tag(UUID, TEXT) TO authenticated, anon;

-- ============================================
-- VERIFICATION
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 042_add_tags_to_conversations completed successfully!';
  RAISE NOTICE '📋 Added to conversations table:';
  RAISE NOTICE '   - tags column (TEXT[] array with GIN index)';
  RAISE NOTICE '   - submission_id column (UUID foreign key to project_submissions)';
  RAISE NOTICE '⚙️  Added helper functions:';
  RAISE NOTICE '   - update_conversation_tags(conversation_id, tags_array)';
  RAISE NOTICE '   - add_conversation_tag(conversation_id, tag)';
  RAISE NOTICE '   - remove_conversation_tag(conversation_id, tag)';
  RAISE NOTICE '   - conversation_has_tag(conversation_id, tag) -> boolean';
  RAISE NOTICE '🔍 Created GIN index for efficient tag searching';
END $$;
