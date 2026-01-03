-- Add revision-related dispute types to job_disputes table
-- Migration: 20241207000001_add_revision_dispute_types.sql

-- Drop existing constraint (it has limited dispute types)
ALTER TABLE job_disputes DROP CONSTRAINT IF EXISTS check_dispute_type;

-- Add updated constraint with revision dispute types
ALTER TABLE job_disputes ADD CONSTRAINT check_dispute_type 
  CHECK (dispute_type IS NULL OR dispute_type IN (
    -- General dispute types
    'quality_issues',
    'deadline_missed',
    'requirements_not_met',
    'payment_issue',
    'communication_failure',
    'scope_creep',
    -- Social media specific dispute reasons
    'social_wrongful_denial',
    'social_fake_followers',
    'social_link_invalid',
    -- Revision-related dispute reasons
    'revision_refusal',           -- Poster: worker refused committed revision
    'unlimited_revisions_abuse',  -- Worker: poster abusing unlimited revisions
    'other'
  ));

-- Add column for revision context metadata (JSON)
ALTER TABLE job_disputes ADD COLUMN IF NOT EXISTS revision_context JSONB;

-- Add comment explaining the new types and column
COMMENT ON COLUMN job_disputes.dispute_type IS 'Categorized dispute type. Includes revision types: revision_refusal (worker refused committed revision), unlimited_revisions_abuse (poster abusing unlimited revisions)';
COMMENT ON COLUMN job_disputes.revision_context IS 'JSON object containing revision-related dispute context: revisions_offered, revisions_used, revisions_remaining, revision_history, unanswered_since';








