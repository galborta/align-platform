-- Migration: Fix user_profiles RLS policies for presence tracking
-- Description: Update RLS policies to allow reading all profiles (needed for presence tracking and messaging)
-- Created: 2025-11-25

-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Public read for public profiles" ON user_profiles;

-- Create more permissive SELECT policy
-- Allow reading all user profiles (needed for presence tracking, messaging, profile views)
CREATE POLICY "Anyone can read user profiles" ON user_profiles
  FOR SELECT USING (true);

-- Keep the existing INSERT and UPDATE policies (they're fine)
-- Users can insert their own profile (policy already exists)
-- Users can update their own profile (policy already exists)

-- Add comment
COMMENT ON POLICY "Anyone can read user profiles" ON user_profiles IS 
  'Allows reading all user profiles for presence tracking, messaging, and profile viewing. Privacy is controlled at application level via privacy_level field.';





