-- Add notification preference columns to user_profiles table
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS notification_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS notification_sound BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS notification_preview TEXT DEFAULT 'full' CHECK (notification_preview IN ('full', 'sender', 'none'));

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_notification_enabled 
ON user_profiles(notification_enabled) 
WHERE notification_enabled = true;

-- Add comment for documentation
COMMENT ON COLUMN user_profiles.notification_enabled IS 'Whether the user has enabled browser notifications for messages';
COMMENT ON COLUMN user_profiles.notification_sound IS 'Whether to play a sound when notifications appear';
COMMENT ON COLUMN user_profiles.notification_preview IS 'How much message content to show in notifications: full, sender, or none';











