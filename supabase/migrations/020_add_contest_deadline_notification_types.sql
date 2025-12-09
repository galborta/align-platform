-- ============================================================================
-- Migration: 020_add_contest_deadline_notification_types.sql
-- Description: Add notification types for contest deadline scenarios
-- Created: December 9, 2025
-- ============================================================================

-- Add new notification types for contest deadline scenarios
ALTER TABLE notifications 
DROP CONSTRAINT IF EXISTS valid_notification_type;

ALTER TABLE notifications
ADD CONSTRAINT valid_notification_type CHECK (type IN (
    -- Existing types
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
    'revision_requested',
    'voluntary_revision_requested',
    'voluntary_revision_accepted',
    'voluntary_revision_declined',
    'high_revision_count_warning_poster',
    'high_revision_count_warning_worker',
    'contest_judging_started',
    'contest_winners_selected',
    'contest_prize_won',
    -- NEW: Contest deadline notification types
    'contest_no_submissions',
    'contest_deadline_reminder',
    'job_status_changed'
));

-- Add comment describing the new types
COMMENT ON CONSTRAINT valid_notification_type ON notifications IS 
'Valid notification types including contest deadline scenarios:
- contest_no_submissions: Contest deadline passed with no submissions (can cancel for refund)
- contest_deadline_reminder: Reminder about upcoming contest deadline
- job_status_changed: General job status change notification';

