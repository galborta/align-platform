-- Enhanced Tip System Schema Updates
-- Date: 2024-11-26
-- Description: Adds support for multi-token tipping, karma rewards, public/private tips,
--              USD tracking, and daily karma caps

-- ==================== chat_tips TABLE UPDATES ====================

-- Rename amount_nub to amount_tokens (more generic)
ALTER TABLE chat_tips 
  RENAME COLUMN amount_nub TO amount_tokens;

-- Add new columns for enhanced functionality
ALTER TABLE chat_tips
  ADD COLUMN IF NOT EXISTS token_symbol TEXT,
  ADD COLUMN IF NOT EXISTS amount_usd NUMERIC,
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS karma_awarded_sender NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS karma_awarded_recipient NUMERIC NOT NULL DEFAULT 0;

-- Update existing rows to have token_symbol (assuming NUB for legacy data)
UPDATE chat_tips 
SET token_symbol = 'NUB' 
WHERE token_symbol IS NULL;

-- Make token_symbol NOT NULL after backfill
ALTER TABLE chat_tips 
  ALTER COLUMN token_symbol SET NOT NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_tips_is_public 
  ON chat_tips(project_id, is_public, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_tips_sender_karma 
  ON chat_tips(from_wallet, karma_awarded_sender);

CREATE INDEX IF NOT EXISTS idx_chat_tips_recipient_karma 
  ON chat_tips(to_wallet, karma_awarded_recipient);

CREATE INDEX IF NOT EXISTS idx_chat_tips_token_symbol
  ON chat_tips(token_symbol, created_at DESC);

-- Add comments
COMMENT ON COLUMN chat_tips.amount_tokens IS 'Amount of tokens sent (previously amount_nub, renamed for multi-token support)';
COMMENT ON COLUMN chat_tips.token_symbol IS 'Token symbol (e.g., SOL, USDC, NUB) for display purposes';
COMMENT ON COLUMN chat_tips.amount_usd IS 'USD value of tip at time of sending (can be null if price unavailable)';
COMMENT ON COLUMN chat_tips.is_public IS 'If true, tip appears in public activity feed. If false, only sent as DM';
COMMENT ON COLUMN chat_tips.karma_awarded_sender IS 'Actual karma points awarded to sender (after daily cap)';
COMMENT ON COLUMN chat_tips.karma_awarded_recipient IS 'Actual karma points awarded to recipient (after daily cap)';

-- ==================== wallet_karma TABLE UPDATES ====================

-- Add tip tracking columns
ALTER TABLE wallet_karma
  ADD COLUMN IF NOT EXISTS tips_sent_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tips_received_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tip_karma_earned_today NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tip_karma_last_reset_date DATE NOT NULL DEFAULT CURRENT_DATE;

-- Add index for daily karma queries
CREATE INDEX IF NOT EXISTS idx_wallet_karma_daily_tip 
  ON wallet_karma(wallet_address, project_id, tip_karma_last_reset_date);

-- Add comments
COMMENT ON COLUMN wallet_karma.tips_sent_count IS 'Total number of tips sent by this wallet';
COMMENT ON COLUMN wallet_karma.tips_received_count IS 'Total number of tips received by this wallet';
COMMENT ON COLUMN wallet_karma.tip_karma_earned_today IS 'Karma earned from tipping today (resets daily at midnight UTC)';
COMMENT ON COLUMN wallet_karma.tip_karma_last_reset_date IS 'Last date when daily tip karma was reset';

-- ==================== DATABASE FUNCTIONS ====================

-- Function to reset daily tip karma (to be called by cron job)
CREATE OR REPLACE FUNCTION reset_daily_tip_karma()
RETURNS void AS $$
BEGIN
  UPDATE wallet_karma
  SET 
    tip_karma_earned_today = 0,
    tip_karma_last_reset_date = CURRENT_DATE
  WHERE tip_karma_last_reset_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION reset_daily_tip_karma IS 'Resets daily tip karma counter for all wallets (run daily via cron)';

-- Function to award tip karma with daily cap enforcement
CREATE OR REPLACE FUNCTION award_tip_karma(
  p_wallet_address TEXT,
  p_project_id UUID,
  p_karma_amount NUMERIC,
  p_is_sender BOOLEAN
)
RETURNS NUMERIC AS $$
DECLARE
  v_current_daily_karma NUMERIC;
  v_remaining_daily_karma NUMERIC;
  v_karma_to_award NUMERIC;
  v_last_reset_date DATE;
BEGIN
  -- Get or create wallet karma record
  INSERT INTO wallet_karma (wallet_address, project_id)
  VALUES (p_wallet_address, p_project_id)
  ON CONFLICT (wallet_address, project_id) DO NOTHING;

  -- Get current daily karma and last reset date
  SELECT 
    tip_karma_earned_today,
    tip_karma_last_reset_date
  INTO 
    v_current_daily_karma,
    v_last_reset_date
  FROM wallet_karma
  WHERE wallet_address = p_wallet_address
    AND project_id = p_project_id;

  -- Reset daily karma if new day
  IF v_last_reset_date < CURRENT_DATE THEN
    v_current_daily_karma := 0;
    UPDATE wallet_karma
    SET 
      tip_karma_earned_today = 0,
      tip_karma_last_reset_date = CURRENT_DATE
    WHERE wallet_address = p_wallet_address
      AND project_id = p_project_id;
  END IF;

  -- Calculate remaining karma allowed today (5000 cap)
  v_remaining_daily_karma := GREATEST(0, 5000 - v_current_daily_karma);

  -- Cap the karma to award
  v_karma_to_award := LEAST(p_karma_amount, v_remaining_daily_karma);

  -- Update wallet karma
  UPDATE wallet_karma
  SET 
    total_karma_points = total_karma_points + v_karma_to_award,
    tip_karma_earned_today = tip_karma_earned_today + v_karma_to_award,
    tips_sent_count = CASE 
      WHEN p_is_sender THEN tips_sent_count + 1 
      ELSE tips_sent_count 
    END,
    tips_received_count = CASE 
      WHEN NOT p_is_sender THEN tips_received_count + 1 
      ELSE tips_received_count 
    END,
    updated_at = NOW()
  WHERE wallet_address = p_wallet_address
    AND project_id = p_project_id;

  RETURN v_karma_to_award;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION award_tip_karma IS 'Awards karma for tipping with daily 5000 cap enforcement. Returns actual karma awarded.';

-- ==================== VERIFICATION ====================

-- Verify migration success
DO $$
BEGIN
  -- Check chat_tips columns exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'chat_tips' AND column_name = 'amount_tokens'
  ) THEN
    RAISE EXCEPTION 'Migration failed: amount_tokens column not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'chat_tips' AND column_name = 'token_symbol'
  ) THEN
    RAISE EXCEPTION 'Migration failed: token_symbol column not found';
  END IF;

  -- Check wallet_karma columns exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'wallet_karma' AND column_name = 'tips_sent_count'
  ) THEN
    RAISE EXCEPTION 'Migration failed: tips_sent_count column not found';
  END IF;

  RAISE NOTICE 'Migration completed successfully! Enhanced Tip System is ready.';
END $$;












