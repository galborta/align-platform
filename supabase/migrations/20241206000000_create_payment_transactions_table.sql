-- Migration: Create Payment Transactions Table
-- Created: 2024-12-06
-- Description: Tracks payment transaction status for social media jobs
--              Supports full lifecycle tracking: pending → confirmed/failed

-- ==================== CREATE TABLE ====================

CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN (
    'social_job_payment',  -- Multi-recipient social media job payment
    'escrow_lock',         -- Initial escrow lock when job created
    'refund',              -- Refund to poster for unused budget
    'worker_payment',      -- Individual worker payment (non-social)
    'fee_collection'       -- Platform fee collection
  )),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',    -- Transaction created, awaiting confirmation
    'confirmed',  -- Transaction confirmed on-chain
    'failed'      -- Transaction failed
  )),
  
  -- Transaction details
  transaction_signature TEXT,          -- Solana transaction signature
  total_amount_tokens NUMERIC(20, 8),  -- Total tokens transferred
  platform_fee_tokens NUMERIC(20, 8),  -- Platform fee portion
  refund_amount_tokens NUMERIC(20, 8), -- Refund portion (if applicable)
  recipient_count INTEGER,             -- Number of payment recipients
  
  -- Token information
  token_mint TEXT,                     -- SPL token mint address
  token_symbol TEXT,                   -- Token symbol (e.g., 'SOL', 'USDC')
  
  -- Metadata
  error_message TEXT,                  -- Error details if failed
  retry_count INTEGER DEFAULT 0,       -- Number of retry attempts
  metadata JSONB,                      -- Additional metadata (recipient details, etc.)
  
  -- Timestamps
  confirmed_at TIMESTAMPTZ,            -- When transaction was confirmed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add table comment
COMMENT ON TABLE payment_transactions IS 'Tracks payment transaction lifecycle for jobs, including social media job multi-recipient payments';

-- Add column comments
COMMENT ON COLUMN payment_transactions.transaction_type IS 'Type of payment: social_job_payment, escrow_lock, refund, worker_payment, fee_collection';
COMMENT ON COLUMN payment_transactions.status IS 'Transaction status: pending (awaiting confirmation), confirmed (on-chain), failed';
COMMENT ON COLUMN payment_transactions.transaction_signature IS 'Solana transaction signature for on-chain verification';
COMMENT ON COLUMN payment_transactions.total_amount_tokens IS 'Total tokens transferred in this transaction';
COMMENT ON COLUMN payment_transactions.platform_fee_tokens IS 'Platform fee portion of the transaction';
COMMENT ON COLUMN payment_transactions.refund_amount_tokens IS 'Refund amount to poster (for unused budget in tiered jobs)';
COMMENT ON COLUMN payment_transactions.recipient_count IS 'Number of recipients for multi-recipient transactions';
COMMENT ON COLUMN payment_transactions.metadata IS 'JSONB field for additional data like recipient breakdown';

-- ==================== INDEXES ====================

-- Index for querying by job (most common query pattern)
CREATE INDEX idx_payment_transactions_job_id 
  ON payment_transactions(job_id);

-- Index for querying by status (for cron jobs finding pending transactions)
CREATE INDEX idx_payment_transactions_status 
  ON payment_transactions(status);

-- Index for querying by signature (for transaction verification)
CREATE INDEX idx_payment_transactions_signature 
  ON payment_transactions(transaction_signature) 
  WHERE transaction_signature IS NOT NULL;

-- Composite index for common query: pending transactions for a job
CREATE INDEX idx_payment_transactions_job_status 
  ON payment_transactions(job_id, status);

-- Index for finding recent transactions
CREATE INDEX idx_payment_transactions_created_at 
  ON payment_transactions(created_at DESC);

-- ==================== TRIGGERS ====================

-- Updated at trigger function
CREATE OR REPLACE FUNCTION update_payment_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger
DROP TRIGGER IF EXISTS payment_transactions_updated_at ON payment_transactions;
CREATE TRIGGER payment_transactions_updated_at
  BEFORE UPDATE ON payment_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_transactions_updated_at();

-- ==================== RLS POLICIES ====================

-- Enable RLS
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view transactions for jobs they're involved in
CREATE POLICY "Users can view their job transactions"
  ON payment_transactions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM jobs 
      WHERE jobs.id = payment_transactions.job_id
      AND (
        jobs.poster_wallet = auth.jwt() ->> 'wallet_address'
        OR EXISTS (
          SELECT 1 FROM job_submissions 
          WHERE job_submissions.job_id = jobs.id 
          AND job_submissions.worker_wallet = auth.jwt() ->> 'wallet_address'
        )
      )
    )
  );

-- Policy: Service role can do anything (for API routes)
CREATE POLICY "Service role has full access"
  ON payment_transactions
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ==================== HELPER FUNCTIONS ====================

-- Function to get pending transactions for a job
CREATE OR REPLACE FUNCTION get_pending_payment_transactions(p_job_id UUID)
RETURNS SETOF payment_transactions AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM payment_transactions
  WHERE job_id = p_job_id
  AND status = 'pending'
  ORDER BY created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to confirm a transaction
CREATE OR REPLACE FUNCTION confirm_payment_transaction(
  p_transaction_id UUID,
  p_signature TEXT
)
RETURNS payment_transactions AS $$
DECLARE
  v_result payment_transactions;
BEGIN
  UPDATE payment_transactions
  SET 
    status = 'confirmed',
    transaction_signature = p_signature,
    confirmed_at = NOW()
  WHERE id = p_transaction_id
  RETURNING * INTO v_result;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark a transaction as failed
CREATE OR REPLACE FUNCTION fail_payment_transaction(
  p_transaction_id UUID,
  p_error_message TEXT
)
RETURNS payment_transactions AS $$
DECLARE
  v_result payment_transactions;
BEGIN
  UPDATE payment_transactions
  SET 
    status = 'failed',
    error_message = p_error_message,
    retry_count = retry_count + 1
  WHERE id = p_transaction_id
  RETURNING * INTO v_result;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================== GRANTS ====================

-- Grant access to authenticated users (read only)
GRANT SELECT ON payment_transactions TO authenticated;

-- Grant full access to service role
GRANT ALL ON payment_transactions TO service_role;

