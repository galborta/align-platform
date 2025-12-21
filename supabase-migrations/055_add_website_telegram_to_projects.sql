-- Add website and telegram columns to the projects table
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS website TEXT,
ADD COLUMN IF NOT EXISTS telegram TEXT;

-- Add comments to document the columns
COMMENT ON COLUMN projects.website IS 
  'Official website URL for the project';

COMMENT ON COLUMN projects.telegram IS 
  'Telegram username or link for the project (e.g., @username or t.me/username)';

