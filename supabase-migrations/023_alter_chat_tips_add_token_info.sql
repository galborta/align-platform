-- Migration: Add token_mint and tx_signature to chat_tips table
-- Description: Extends chat_tips table to support any SPL token and track on-chain transactions
-- Created: 2025-11-25

-- Add new columns to chat_tips
ALTER TABLE chat_tips 
  ADD COLUMN IF NOT EXISTS token_mint TEXT,
  ADD COLUMN IF NOT EXISTS tx_signature TEXT;

-- Create index for tx_signature lookups
CREATE INDEX IF NOT EXISTS idx_chat_tips_tx_signature ON chat_tips(tx_signature);
CREATE INDEX IF NOT EXISTS idx_chat_tips_token_mint ON chat_tips(token_mint);

-- Add comments for documentation
COMMENT ON COLUMN chat_tips.token_mint IS 'SPL token mint address for the tipped token';
COMMENT ON COLUMN chat_tips.tx_signature IS 'Solana transaction signature for on-chain verification';




