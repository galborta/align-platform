-- Create RPC function for adding/updating karma
-- This function handles upsert logic for wallet_karma table
-- Used when users submit assets, vote, or receive karma rewards

CREATE OR REPLACE FUNCTION add_karma(
  p_wallet TEXT,
  p_project_id UUID,
  p_karma_delta NUMERIC
) RETURNS void AS $$
BEGIN
  -- Insert new karma record or update existing one
  INSERT INTO wallet_karma (
    wallet_address, 
    project_id, 
    total_karma_points, 
    updated_at
  )
  VALUES (
    p_wallet, 
    p_project_id, 
    p_karma_delta, 
    NOW()
  )
  ON CONFLICT (wallet_address, project_id)
  DO UPDATE SET 
    total_karma_points = wallet_karma.total_karma_points + p_karma_delta,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION add_karma(TEXT, UUID, NUMERIC) TO authenticated;

-- Grant execute permission to anon users (since we use anon key in client)
GRANT EXECUTE ON FUNCTION add_karma(TEXT, UUID, NUMERIC) TO anon;

-- Add comment for documentation
COMMENT ON FUNCTION add_karma IS 'Adds or updates karma points for a wallet in a specific project. Handles upsert logic automatically.';

