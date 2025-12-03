-- Create RPC function to safely increment karma fields
-- This function is called from the API to safely update karma counts

CREATE OR REPLACE FUNCTION increment_karma_field(
  wallet_address TEXT,
  field_name TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Ensure wallet_karma record exists
  INSERT INTO wallet_karma (wallet, created_at)
  VALUES (wallet_address, NOW())
  ON CONFLICT (wallet) DO NOTHING;

  -- Increment the specified field
  EXECUTE format(
    'UPDATE wallet_karma SET %I = %I + 1 WHERE wallet = $1',
    field_name, field_name
  ) USING wallet_address;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION increment_karma_field(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_karma_field(TEXT, TEXT) TO service_role;

