-- ==================== ENVIRONMENT FILTERING SYSTEM ====================
-- 
-- Purpose: Add environment column to core tables to separate localhost test data 
-- from production data. Prevents test data from appearing on live site.
--
-- Tables Updated:
-- - jobs
-- - job_submissions
-- - job_applications
-- - projects
-- - pending_assets
--
-- Behavior:
-- - Production: Only shows environment='production' records
-- - Localhost: Shows ALL records (both dev and prod) for testing
-- - Default: 'production' (all new records visible by default)
--
-- ==================== ADD ENVIRONMENT COLUMN ====================

-- Add environment column to jobs table
ALTER TABLE jobs 
ADD COLUMN environment TEXT NOT NULL DEFAULT 'production';

-- Add environment column to job_submissions table
ALTER TABLE job_submissions 
ADD COLUMN environment TEXT NOT NULL DEFAULT 'production';

-- Add environment column to job_applications table
ALTER TABLE job_applications 
ADD COLUMN environment TEXT NOT NULL DEFAULT 'production';

-- Add environment column to projects table
ALTER TABLE projects 
ADD COLUMN environment TEXT NOT NULL DEFAULT 'production';

-- Add environment column to pending_assets table
ALTER TABLE pending_assets 
ADD COLUMN environment TEXT NOT NULL DEFAULT 'production';

-- ==================== UPDATE EXISTING DATA ====================
-- Mark all existing records as 'production' (safest default)

UPDATE jobs SET environment = 'production' WHERE environment IS NULL;
UPDATE job_submissions SET environment = 'production' WHERE environment IS NULL;
UPDATE job_applications SET environment = 'production' WHERE environment IS NULL;
UPDATE projects SET environment = 'production' WHERE environment IS NULL;
UPDATE pending_assets SET environment = 'production' WHERE environment IS NULL;

-- ==================== CREATE INDEXES ====================
-- Improve query performance for environment filtering

CREATE INDEX idx_jobs_environment ON jobs(environment);
CREATE INDEX idx_job_submissions_environment ON job_submissions(environment);
CREATE INDEX idx_job_applications_environment ON job_applications(environment);
CREATE INDEX idx_projects_environment ON projects(environment);
CREATE INDEX idx_pending_assets_environment ON pending_assets(environment);

-- ==================== ADD CONSTRAINTS ====================
-- Ensure only valid environment values

ALTER TABLE jobs 
ADD CONSTRAINT jobs_environment_check 
CHECK (environment IN ('production', 'development'));

ALTER TABLE job_submissions 
ADD CONSTRAINT job_submissions_environment_check 
CHECK (environment IN ('production', 'development'));

ALTER TABLE job_applications 
ADD CONSTRAINT job_applications_environment_check 
CHECK (environment IN ('production', 'development'));

ALTER TABLE projects 
ADD CONSTRAINT projects_environment_check 
CHECK (environment IN ('production', 'development'));

ALTER TABLE pending_assets 
ADD CONSTRAINT pending_assets_environment_check 
CHECK (environment IN ('production', 'development'));

-- ==================== MIGRATION COMPLETE ====================
-- 
-- Next Steps:
-- 1. Deploy this migration to Supabase
-- 2. Update application code to use getEnvironment() and getEnvironmentFilter()
-- 3. Add "Publish to Production" checkbox to localhost forms
-- 4. Test thoroughly on both localhost and production
--
-- Rollback (if needed):
-- ALTER TABLE jobs DROP COLUMN environment;
-- ALTER TABLE job_submissions DROP COLUMN environment;
-- ALTER TABLE job_applications DROP COLUMN environment;
-- ALTER TABLE projects DROP COLUMN environment;
-- ALTER TABLE pending_assets DROP COLUMN environment;
