-- Create storage bucket for job application attachments
-- Migration: 019_create_job_attachments_storage
-- Created: November 24, 2025

-- Create the bucket (public access for viewing)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'job-attachments',
  'job-attachments',
  true,  -- Public read access
  10485760,  -- 10MB limit (for work deliverables)
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
-- Note: Using 'public' role since app uses Solana wallet auth, not Supabase auth

-- 1. Allow public users to upload files (wallet-connected users)
CREATE POLICY "Users can upload job attachments"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'job-attachments');

-- 2. Allow public read access to all attachments
CREATE POLICY "Public can view job attachments"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'job-attachments');

-- 3. Allow users to delete their own attachments
CREATE POLICY "Users can delete own attachments"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'job-attachments');

-- 4. Allow users to update their own attachments
CREATE POLICY "Users can update own attachments"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'job-attachments')
WITH CHECK (bucket_id = 'job-attachments');

-- Add comment
COMMENT ON TABLE storage.buckets IS 'Storage buckets for user-uploaded files';

-- Migration complete
-- Bucket 'job-attachments' is now ready for use






