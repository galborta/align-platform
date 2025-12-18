-- ============================================================================
-- Migration: Add contest notification types to notifications table
-- Description: Updates the notification type and reference_type constraints
--              to include contest-related notification types
-- Created: 2024-12-07
-- ============================================================================

-- Drop existing constraints
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS valid_notification_type;
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS valid_reference_type;

-- Re-create notification type constraint with all types including contest types
ALTER TABLE notifications ADD CONSTRAINT valid_notification_type CHECK (type IN (
    -- Original types
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
    'admin_revenue_earned',
    -- Social media job notifications
    'social_submission_received',
    'social_submission_approved',
    'social_submission_denied',
    'social_payment_distributed',
    -- Revision notifications
    'revision_requested',
    'voluntary_revision_requested',
    'voluntary_revision_accepted',
    'voluntary_revision_declined',
    'high_revision_count_warning_poster',
    'high_revision_count_warning_worker',
    -- Contest notifications (NEW)
    'contest_judging_started',
    'contest_winners_selected',
    'contest_prize_won'
));

-- Re-create reference type constraint with contest type
ALTER TABLE notifications ADD CONSTRAINT valid_reference_type CHECK (reference_type IN (
    'job',
    'asset', 
    'message',
    'tip',
    'conversation',
    'karma',
    'payment',
    'dispute',
    'social_submission',
    'contest'
) OR reference_type IS NULL);

-- Add helpful comments
COMMENT ON CONSTRAINT valid_notification_type ON notifications IS 'Allowed notification types including contest notifications';
COMMENT ON CONSTRAINT valid_reference_type ON notifications IS 'Allowed reference types including contest';






