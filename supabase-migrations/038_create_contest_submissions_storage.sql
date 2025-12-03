-- Migration: Create contest-submissions storage bucket
-- Created: December 2024
-- Description: Storage bucket for contest submission images
-- Status: APPLIED via Supabase MCP

-- Create the bucket (public access for viewing)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contest-submissions',
  'contest-submissions',
  true,  -- Public read access
  5242880,  -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
-- Note: Using 'public' role since app uses Solana wallet auth, not Supabase auth

-- 1. Allow public users to upload files (wallet-connected users)
CREATE POLICY "Users can upload contest submission images"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'contest-submissions');

-- 2. Allow public read access to all submission images
CREATE POLICY "Public can view contest submission images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'contest-submissions');

-- 3. Allow users to delete their submission images
CREATE POLICY "Users can delete contest submission images"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'contest-submissions');

-- 4. Allow users to update their submission images
CREATE POLICY "Users can update contest submission images"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'contest-submissions')
WITH CHECK (bucket_id = 'contest-submissions');

-- ==================== VERIFICATION ====================
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 038_create_contest_submissions_storage completed!';
  RAISE NOTICE '📦 Created bucket: contest-submissions';
  RAISE NOTICE '📋 Bucket settings:';
  RAISE NOTICE '   - Public: true';
  RAISE NOTICE '   - File size limit: 5MB';
  RAISE NOTICE '   - Allowed types: jpeg, jpg, png, gif, webp';
  RAISE NOTICE '🔐 Created 4 storage policies:';
  RAISE NOTICE '   - Users can upload contest submission images (INSERT)';
  RAISE NOTICE '   - Public can view contest submission images (SELECT)';
  RAISE NOTICE '   - Users can delete contest submission images (DELETE)';
  RAISE NOTICE '   - Users can update contest submission images (UPDATE)';
END $$;

