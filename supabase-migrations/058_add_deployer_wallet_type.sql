-- Migration: Add deployer wallet type to team_wallets
-- Created: 2024-12-29
-- Description: Adds 'deployer' as a valid wallet type for storing deployer wallet addresses

-- Drop existing constraint
ALTER TABLE team_wallets
DROP CONSTRAINT IF EXISTS team_wallets_wallet_type_check;

-- Add updated check constraint that includes 'deployer'
ALTER TABLE team_wallets
ADD CONSTRAINT team_wallets_wallet_type_check 
CHECK (wallet_type IN ('team', 'treasury', 'liquidity', 'deployer', 'other'));

-- Update comment to document the new wallet type
COMMENT ON COLUMN team_wallets.wallet_type IS 
  'Type of wallet: team (team member), treasury (project treasury), liquidity (liquidity provision), deployer (contract deployer), other (custom)';


