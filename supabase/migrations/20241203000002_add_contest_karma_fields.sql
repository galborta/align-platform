-- Add contest voting tracking to wallet_karma

ALTER TABLE wallet_karma ADD COLUMN contest_votes_cast_count INTEGER DEFAULT 0;

ALTER TABLE wallet_karma ADD COLUMN contest_votes_won_count INTEGER DEFAULT 0;

-- Add helpful comments
COMMENT ON COLUMN wallet_karma.contest_votes_cast_count IS 'Number of votes cast on contest submissions';
COMMENT ON COLUMN wallet_karma.contest_votes_won_count IS 'Number of times user voted for winning submissions';

