-- Migration: Add wallet_type column to team_wallets
-- Created: 2024-12-21
-- Description: Adds wallet_type column to distinguish between team, treasury, liquidity, and other wallets

-- Add wallet_type column with default value 'team' for backwards compatibility
ALTER TABLE team_wallets
ADD COLUMN IF NOT EXISTS wallet_type TEXT NOT NULL DEFAULT 'team';

-- Add check constraint to ensure valid wallet types
ALTER TABLE team_wallets
DROP CONSTRAINT IF EXISTS team_wallets_wallet_type_check;

ALTER TABLE team_wallets
ADD CONSTRAINT team_wallets_wallet_type_check 
CHECK (wallet_type IN ('team', 'treasury', 'liquidity', 'other'));

-- Add comment to document the column
COMMENT ON COLUMN team_wallets.wallet_type IS 
  'Type of wallet: team (team member), treasury (project treasury), liquidity (liquidity provision), other (custom)';

