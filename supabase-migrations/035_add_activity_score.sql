-- Migration: Add activity_score computed column to projects table
-- Purpose: Sort projects by engagement level (active jobs weighted 3x, completed jobs 1x)
-- Date: November 30, 2025

-- Step 1: Check if active_jobs_count and total_jobs_completed columns exist
-- If not, add them first
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'projects' AND column_name = 'active_jobs_count'
  ) THEN
    ALTER TABLE projects ADD COLUMN active_jobs_count INTEGER DEFAULT 0 NOT NULL;
    COMMENT ON COLUMN projects.active_jobs_count IS 'Count of jobs with status = open';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'projects' AND column_name = 'total_jobs_completed'
  ) THEN
    ALTER TABLE projects ADD COLUMN total_jobs_completed INTEGER DEFAULT 0 NOT NULL;
    COMMENT ON COLUMN projects.total_jobs_completed IS 'Count of jobs with status = completed';
  END IF;
END $$;

-- Step 2: Add activity_score as a generated column (computed on insert/update)
-- Formula: (active_jobs_count * 3) + (total_jobs_completed * 1)
-- Rationale: Active jobs are weighted 3x to prioritize current activity
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'projects' AND column_name = 'activity_score'
  ) THEN
    ALTER TABLE projects 
    ADD COLUMN activity_score INTEGER GENERATED ALWAYS AS 
    (COALESCE(active_jobs_count, 0) * 3 + COALESCE(total_jobs_completed, 0) * 1) STORED;
    
    COMMENT ON COLUMN projects.activity_score IS 'Computed activity score: (active_jobs * 3) + (completed_jobs * 1)';
  END IF;
END $$;

-- Step 3: Create index for performance on activity_score (descending order)
CREATE INDEX IF NOT EXISTS idx_projects_activity_score 
ON projects(activity_score DESC NULLS LAST, created_at DESC);

-- Step 4: Create function to update job counts (to be called when jobs change)
CREATE OR REPLACE FUNCTION update_project_job_counts()
RETURNS TRIGGER AS $$
BEGIN
  -- Update active jobs count
  UPDATE projects
  SET active_jobs_count = (
    SELECT COUNT(*)
    FROM jobs
    WHERE project_id = COALESCE(NEW.project_id, OLD.project_id)
    AND status = 'open'
  ),
  total_jobs_completed = (
    SELECT COUNT(*)
    FROM jobs
    WHERE project_id = COALESCE(NEW.project_id, OLD.project_id)
    AND status = 'completed'
  )
  WHERE id = COALESCE(NEW.project_id, OLD.project_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create trigger to auto-update counts when jobs change
DROP TRIGGER IF EXISTS trigger_update_project_job_counts ON jobs;
CREATE TRIGGER trigger_update_project_job_counts
AFTER INSERT OR UPDATE OF status OR DELETE ON jobs
FOR EACH ROW
EXECUTE FUNCTION update_project_job_counts();

-- Step 6: Initial population of job counts for existing projects
UPDATE projects p
SET 
  active_jobs_count = (
    SELECT COUNT(*)
    FROM jobs j
    WHERE j.project_id = p.id
    AND j.status = 'open'
  ),
  total_jobs_completed = (
    SELECT COUNT(*)
    FROM jobs j
    WHERE j.project_id = p.id
    AND j.status = 'completed'
  );

-- Verification: Query to check activity scores
-- SELECT id, name, active_jobs_count, total_jobs_completed, activity_score
-- FROM projects
-- ORDER BY activity_score DESC NULLS LAST, created_at DESC
-- LIMIT 10;

-- Note: activity_score will be automatically updated when job counts change
-- since it's a GENERATED ALWAYS column
