-- Add support for threaded replies to job comments
-- Adds parent_comment_id field to allow nested comments

-- Add parent_comment_id column to support replies
ALTER TABLE job_comments 
ADD COLUMN IF NOT EXISTS parent_comment_id UUID REFERENCES job_comments(id) ON DELETE CASCADE;

-- Add index for efficient querying of replies
CREATE INDEX IF NOT EXISTS idx_job_comments_parent_id ON job_comments(parent_comment_id);

-- Add index for fetching top-level comments (null parent)
CREATE INDEX IF NOT EXISTS idx_job_comments_top_level ON job_comments(job_id, parent_comment_id) 
WHERE parent_comment_id IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN job_comments.parent_comment_id IS 'Reference to parent comment for threaded replies. NULL for top-level comments.';







