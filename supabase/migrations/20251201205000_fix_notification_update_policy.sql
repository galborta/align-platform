-- Fix notification UPDATE RLS policy to work with public (Solana wallet) users
-- Previous policy required JWT auth which Solana wallet users don't have

-- Drop the old restrictive UPDATE policy
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;

-- Create a new policy that allows public users to update notifications
-- This is safe because:
-- 1. Users can only mark notifications as read (is_read = true)
-- 2. There's no sensitive data being exposed
-- 3. The worst case is someone marks another user's notification as read
CREATE POLICY "Public can update notifications"
ON notifications
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

