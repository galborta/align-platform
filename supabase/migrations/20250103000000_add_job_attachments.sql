-- Add attachment support to jobs table
-- This allows posters to upload reference files, briefs, resources, etc.

ALTER TABLE jobs ADD COLUMN attachment_urls TEXT[];

-- Add helpful comment
COMMENT ON COLUMN jobs.attachment_urls IS 'Array of Supabase Storage URLs for job attachments (briefs, references, resources). Publicly accessible for applicants to download.';

-- Create index for jobs with attachments
CREATE INDEX idx_jobs_with_attachments ON jobs(id) WHERE attachment_urls IS NOT NULL AND array_length(attachment_urls, 1) > 0;

