-- ============================================================================
-- Migration: 015_create_notifications_system.sql
-- Description: Comprehensive notification system for all platform activities
-- Created: 2025-11-28
-- ============================================================================

-- ============================================================================
-- SECTION 1: CREATE NOTIFICATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_wallet text NOT NULL,
    type text NOT NULL,
    actor_wallet text,
    reference_id text,
    reference_type text,
    batch_group_key text,
    batch_count integer DEFAULT 1,
    is_read boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    metadata jsonb,
    
    -- Constraints
    CONSTRAINT valid_notification_type CHECK (type IN (
        'job_application_received',
        'job_assigned',
        'job_submitted',
        'job_completed',
        'job_dispute_created',
        'job_dispute_vote',
        'job_comment',
        'asset_upvote',
        'asset_verified',
        'asset_hidden',
        'tip_received',
        'message_received',
        'karma_milestone',
        'karma_warning',
        'karma_ban',
        'payment_released',
        'payment_refunded',
        'admin_dispute_new',
        'admin_job_new',
        'admin_asset_new',
        'admin_revenue_earned'
    )),
    CONSTRAINT valid_reference_type CHECK (reference_type IN (
        'job', 'asset', 'message', 'tip', 'conversation', 'karma', 'payment', 'dispute'
    ) OR reference_type IS NULL)
);

-- Add comment describing the table
COMMENT ON TABLE notifications IS 'User notifications for all platform activities';
COMMENT ON COLUMN notifications.user_wallet IS 'Wallet address of the notification recipient';
COMMENT ON COLUMN notifications.type IS 'Type of notification event';
COMMENT ON COLUMN notifications.actor_wallet IS 'Wallet address of the user who triggered the notification (null for system notifications)';
COMMENT ON COLUMN notifications.reference_id IS 'ID of the related entity (job_id, asset_id, message_id, etc.)';
COMMENT ON COLUMN notifications.reference_type IS 'Type of the referenced entity';
COMMENT ON COLUMN notifications.batch_group_key IS 'Key for grouping similar notifications together';
COMMENT ON COLUMN notifications.batch_count IS 'Number of notifications grouped together';
COMMENT ON COLUMN notifications.metadata IS 'Flexible JSONB storage for notification-specific data';

-- ============================================================================
-- SECTION 2: CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

-- Index for fetching user's recent notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_created 
    ON notifications(user_wallet, created_at DESC);

-- Index for counting unread notifications (partial index)
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread 
    ON notifications(user_wallet, is_read) 
    WHERE is_read = false;

-- Index for finding existing batches (partial index)
CREATE INDEX IF NOT EXISTS idx_notifications_batch_group 
    ON notifications(batch_group_key) 
    WHERE batch_group_key IS NOT NULL;

-- Index for querying notifications by entity
CREATE INDEX IF NOT EXISTS idx_notifications_reference 
    ON notifications(reference_type, reference_id);

-- Index for notification type filtering
CREATE INDEX IF NOT EXISTS idx_notifications_type 
    ON notifications(type, created_at DESC);

-- ============================================================================
-- SECTION 3: ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own notifications
-- Also allows admins to view all notifications
CREATE POLICY "Users can view own notifications"
    ON notifications
    FOR SELECT
    USING (
        user_wallet = current_setting('request.jwt.claims', true)::json->>'wallet'
        OR 
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet' 
            AND is_admin = true
        )
    );

-- Policy: Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
    ON notifications
    FOR UPDATE
    USING (user_wallet = current_setting('request.jwt.claims', true)::json->>'wallet')
    WITH CHECK (user_wallet = current_setting('request.jwt.claims', true)::json->>'wallet');

-- Policy: Service role can insert notifications (API routes)
-- This runs with service role context, so no user check needed
CREATE POLICY "Service can insert notifications"
    ON notifications
    FOR INSERT
    WITH CHECK (true);

-- Policy: Users can delete their own notifications (optional cleanup)
CREATE POLICY "Users can delete own notifications"
    ON notifications
    FOR DELETE
    USING (user_wallet = current_setting('request.jwt.claims', true)::json->>'wallet');

-- ============================================================================
-- SECTION 4: CREATE DATABASE FUNCTIONS
-- ============================================================================

-- Function: Cleanup old notifications (keep last 500 per user)
-- This function runs after each INSERT to maintain a reasonable notification count
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS TRIGGER AS $$
BEGIN
    -- Delete old notifications for this user, keeping only last 500
    -- Prioritizes keeping unread notifications
    DELETE FROM notifications
    WHERE id IN (
        SELECT id FROM notifications
        WHERE user_wallet = NEW.user_wallet
        ORDER BY 
            CASE WHEN is_read THEN 0 ELSE 1 END DESC,  -- Prioritize keeping unread
            created_at DESC
        OFFSET 500  -- Keep 500 most recent
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_notifications() IS 'Keeps only the 500 most recent notifications per user, prioritizing unread notifications';

-- Function: Increment batch count and update timestamp
-- Used when grouping similar notifications together
CREATE OR REPLACE FUNCTION increment_batch_count(notification_id uuid)
RETURNS notifications AS $$
DECLARE
    updated_notification notifications;
BEGIN
    UPDATE notifications
    SET 
        batch_count = batch_count + 1,
        created_at = now(),
        is_read = false  -- Mark as unread when new item added to batch
    WHERE id = notification_id
    RETURNING * INTO updated_notification;
    
    RETURN updated_notification;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION increment_batch_count(uuid) IS 'Increments batch count and refreshes timestamp for grouped notifications';

-- Function: Get unread notification count for a user
CREATE OR REPLACE FUNCTION get_unread_notification_count(wallet_address text)
RETURNS integer AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)::integer
        FROM notifications
        WHERE user_wallet = wallet_address
        AND is_read = false
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_unread_notification_count(text) IS 'Returns the count of unread notifications for a user';

-- Function: Mark notifications as read
CREATE OR REPLACE FUNCTION mark_notifications_read(
    wallet_address text,
    notification_ids uuid[]
)
RETURNS integer AS $$
DECLARE
    updated_count integer;
BEGIN
    UPDATE notifications
    SET is_read = true
    WHERE user_wallet = wallet_address
    AND id = ANY(notification_ids)
    AND is_read = false;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION mark_notifications_read(text, uuid[]) IS 'Marks specified notifications as read and returns count of updated rows';

-- Function: Mark all notifications as read for a user
CREATE OR REPLACE FUNCTION mark_all_notifications_read(wallet_address text)
RETURNS integer AS $$
DECLARE
    updated_count integer;
BEGIN
    UPDATE notifications
    SET is_read = true
    WHERE user_wallet = wallet_address
    AND is_read = false;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION mark_all_notifications_read(text) IS 'Marks all notifications as read for a user and returns count of updated rows';

-- ============================================================================
-- SECTION 5: CREATE TRIGGERS
-- ============================================================================

-- Trigger: Auto-cleanup after insert
-- Automatically runs cleanup function after each notification insert
CREATE TRIGGER trigger_cleanup_old_notifications
    AFTER INSERT ON notifications
    FOR EACH ROW
    EXECUTE FUNCTION cleanup_old_notifications();

COMMENT ON TRIGGER trigger_cleanup_old_notifications ON notifications IS 'Automatically cleans up old notifications after insert';

-- ============================================================================
-- SECTION 6: GRANT PERMISSIONS
-- ============================================================================

-- Grant usage on sequences (if any are added in future)
-- GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Grant execute permissions on functions to authenticated users
GRANT EXECUTE ON FUNCTION get_unread_notification_count(text) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_notifications_read(text, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_all_notifications_read(text) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_batch_count(uuid) TO authenticated;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- To verify the migration was successful, run:
-- SELECT COUNT(*) FROM notifications;
-- SELECT * FROM pg_indexes WHERE tablename = 'notifications';
-- SELECT * FROM pg_policies WHERE tablename = 'notifications';












