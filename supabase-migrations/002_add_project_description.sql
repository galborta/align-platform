-- Add description field to projects table
ALTER TABLE projects ADD COLUMN description TEXT;

-- Add a comment explaining the column
COMMENT ON COLUMN projects.description IS 'Project description displayed on the project page';

