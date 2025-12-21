-- Add domains column to the projects table to store multiple project domains
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS domains TEXT[] DEFAULT '{}';

-- Create a GIN index on domains for efficient searching
CREATE INDEX IF NOT EXISTS projects_domains_gin_idx
ON projects USING GIN (domains);

-- Add comment to document the column
COMMENT ON COLUMN projects.domains IS 
  'Array of domains associated with the project (e.g., example.com, app.example.com)';

