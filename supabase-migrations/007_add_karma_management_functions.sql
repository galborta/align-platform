-- Migration: Add karma management RPC functions
-- Created: 2024-11-20
-- Description: Adds increment_assets_added and add_warning functions for automated status transitions

-- Function to increment assets added count
CREATE OR REPLACE FUNCTION increment_assets_added(
  p_wallet TEXT,
  p_project_id UUID
) RETURNS void AS $$
BEGIN
  UPDATE wallet_karma
  SET 
    assets_added_count = assets_added_count + 1,
    updated_at = NOW()
  WHERE wallet_address = p_wallet AND project_id = p_project_id;
END;
$$ LANGUAGE plpgsql;

-- Function to add warning and check for ban
CREATE OR REPLACE FUNCTION add_warning(
  p_wallet TEXT,
  p_project_id UUID,
  p_reason TEXT
) RETURNS void AS $$
DECLARE
  v_current_warnings JSONB;
  v_current_karma NUMERIC;
  v_should_ban BOOLEAN := FALSE;
BEGIN
  -- Get current state
  SELECT warnings, total_karma_points 
  INTO v_current_warnings, v_current_karma
  FROM wallet_karma
  WHERE wallet_address = p_wallet AND project_id = p_project_id;
  
  -- Add new warning
  v_current_warnings := COALESCE(v_current_warnings, '[]'::jsonb) || 
    jsonb_build_object(
      'timestamp', NOW(),
      'reason', p_reason
    );
  
  -- Check if should ban (active warnings only - within 90 days)
  DECLARE
    v_active_warnings INT := 0;
    v_warning JSONB;
    v_warning_date TIMESTAMP;
  BEGIN
    FOR v_warning IN SELECT jsonb_array_elements(v_current_warnings)
    LOOP
      v_warning_date := (v_warning->>'timestamp')::TIMESTAMP;
      IF v_warning_date > NOW() - INTERVAL '90 days' THEN
        v_active_warnings := v_active_warnings + 1;
      END IF;
    END LOOP;
    
    -- Ban logic
    IF v_current_karma <= 0 AND v_active_warnings >= 2 THEN
      v_should_ban := TRUE;
    ELSIF v_active_warnings >= 3 THEN
      v_should_ban := TRUE;
    END IF;
  END;
  
  -- Update wallet karma
  UPDATE wallet_karma
  SET 
    warnings = v_current_warnings,
    warning_count = jsonb_array_length(v_current_warnings),
    is_banned = v_should_ban,
    banned_at = CASE WHEN v_should_ban THEN NOW() ELSE banned_at END,
    updated_at = NOW()
  WHERE wallet_address = p_wallet AND project_id = p_project_id;
  
  -- Post to chat if banned
  IF v_should_ban THEN
    INSERT INTO curation_chat_messages (
      project_id,
      message_type,
      wallet_address
    ) VALUES (
      p_project_id,
      'wallet_banned',
      p_wallet
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION increment_assets_added(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION add_warning(TEXT, UUID, TEXT) TO authenticated;

-- Also grant to anon for API route usage
GRANT EXECUTE ON FUNCTION increment_assets_added(TEXT, UUID) TO anon;
GRANT EXECUTE ON FUNCTION add_warning(TEXT, UUID, TEXT) TO anon;

