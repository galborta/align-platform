-- ============================================
-- SYSTEM NOTIFICATIONS TABLE
-- ============================================
-- This table stores system-generated notifications
-- (different from message notifications in user_profiles)

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL CHECK (char_length(message) <= 500),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  is_read BOOLEAN DEFAULT false,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('normal', 'high', 'urgent')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_wallet ON notifications(wallet_address, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(wallet_address, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_job ON notifications(job_id) WHERE job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type, created_at DESC);

-- Comments for documentation
COMMENT ON TABLE notifications IS 'System-generated notifications for job events (auto-release, payments, etc.)';
COMMENT ON COLUMN notifications.wallet_address IS 'Wallet address of the notification recipient';
COMMENT ON COLUMN notifications.type IS 'Notification type: job_auto_released, job_payment_released, job_completed, payment_failed, etc.';
COMMENT ON COLUMN notifications.priority IS 'Priority level: normal, high, or urgent';
COMMENT ON COLUMN notifications.job_id IS 'Optional reference to related job';

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "Users can view own notifications"
  ON notifications
  FOR SELECT
  USING (wallet_address = current_setting('request.jwt.claims')::json->>'wallet_address');

-- Users can mark their own notifications as read
CREATE POLICY "Users can update own notifications"
  ON notifications
  FOR UPDATE
  USING (wallet_address = current_setting('request.jwt.claims')::json->>'wallet_address')
  WITH CHECK (wallet_address = current_setting('request.jwt.claims')::json->>'wallet_address');

-- System can insert notifications for any user (service role only)
CREATE POLICY "Service role can insert notifications"
  ON notifications
  FOR INSERT
  WITH CHECK (true);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to count unread notifications
CREATE OR REPLACE FUNCTION get_unread_notification_count(user_wallet TEXT)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM notifications
    WHERE wallet_address = user_wallet
      AND is_read = false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark notifications as read
CREATE OR REPLACE FUNCTION mark_notifications_read(user_wallet TEXT, notification_ids UUID[])
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE notifications
  SET is_read = true,
      read_at = NOW()
  WHERE wallet_address = user_wallet
    AND id = ANY(notification_ids)
    AND is_read = false;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark all notifications as read for a user
CREATE OR REPLACE FUNCTION mark_all_notifications_read(user_wallet TEXT)
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE notifications
  SET is_read = true,
      read_at = NOW()
  WHERE wallet_address = user_wallet
    AND is_read = false;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to delete old read notifications (cleanup)
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM notifications
  WHERE is_read = true
    AND read_at < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- SAMPLE DATA (for testing)
-- ============================================

-- Example notification types:
-- - job_auto_released: Payment auto-released after 10 days
-- - job_payment_released: Payment manually released by poster
-- - job_completed: Job marked as completed
-- - payment_failed: Payment release failed
-- - payment_retry: Payment release retrying
-- - job_assigned: You were assigned to a job
-- - job_submitted: Work was submitted for your job
-- - dispute_opened: Dispute opened on your job
-- - dispute_resolved: Dispute resolved
-- - tip_received: You received a tip
-- - karma_milestone: You reached a karma milestone

