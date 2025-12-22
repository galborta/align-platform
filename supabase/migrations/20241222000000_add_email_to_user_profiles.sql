-- Add email column to user_profiles
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS email TEXT;

-- Add index for email lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_email 
ON user_profiles(email);

-- Add comment
COMMENT ON COLUMN user_profiles.email IS 'User email address for notifications (optional)';

