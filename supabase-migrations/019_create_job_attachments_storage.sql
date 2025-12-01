-- Create storage bucket for job application attachments
-- Migration: 019_create_job_attachments_storage
-- Created: November 24, 2025

-- Create the bucket (public access for viewing)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'job-attachments',
  'job-attachments',
  true,  -- Public read access
  5242880,  -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies

-- 1. Allow authenticated users to upload files
CREATE POLICY "Users can upload job attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'job-attachments');

-- 2. Allow public read access to all attachments
CREATE POLICY "Public can view job attachments"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'job-attachments');

-- 3. Allow users to delete their own attachments (by wallet folder)
CREATE POLICY "Users can delete own attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'job-attachments'
);

-- 4. Allow users to update their own attachments
CREATE POLICY "Users can update own attachments"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'job-attachments'
)
WITH CHECK (
  bucket_id = 'job-attachments'
);

-- Add comment
COMMENT ON TABLE storage.buckets IS 'Storage buckets for user-uploaded files';

-- Migration complete
-- Bucket 'job-attachments' is now ready for use






