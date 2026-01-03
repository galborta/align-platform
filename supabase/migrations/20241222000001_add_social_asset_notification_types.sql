-- ============================================================================
-- Migration: Add social asset notification types to notifications table
-- Description: Updates the notification type constraint to include
--              social asset review notification types
-- Created: 2024-12-22
-- ============================================================================

-- Drop existing constraint
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS valid_notification_type;

-- Re-create notification type constraint with social asset types added
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
    -- Social asset review notifications (NEW)
    'social_asset_pending',
    'social_asset_approved',
    'social_asset_rejected',
    -- Revision notifications
    'revision_requested',
    'voluntary_revision_requested',
    'voluntary_revision_accepted',
    'voluntary_revision_declined',
    'high_revision_count_warning_poster',
    'high_revision_count_warning_worker',
    -- Contest notifications
    'contest_judging_started',
    'contest_winners_selected',
    'contest_prize_won',
    'contest_no_submissions',
    'contest_deadline_reminder',
    -- Job status notifications
    'job_status_changed',
    -- Editor notifications
    'editor_added',
    'editor_removed'
));

-- Comment
COMMENT ON CONSTRAINT valid_notification_type ON notifications IS 
  'Ensures notification type is one of the valid notification types including social asset review types';


