-- Create atomic budget reservation function
-- This prevents race conditions when multiple workers submit simultaneously

/**
 * Reserve Social Budget Function
 * 
 * Atomically reserves budget for a social media job submission.
 * Uses row-level locking (FOR UPDATE) to prevent race conditions.
 * 
 * How it works:
 * 1. Lock the job row to prevent concurrent updates
 * 2. Calculate remaining budget
 * 3. Check if requested amount is available
 * 4. If available: decrement remaining, increment reserved
 * 5. Return success/failure
 * 
 * This ensures that even if 100 workers submit simultaneously,
 * the budget will never be over-allocated.
 */

CREATE OR REPLACE FUNCTION reserve_social_budget(
  p_job_id UUID,
  p_amount DECIMAL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_budget DECIMAL;
  v_released DECIMAL;
  v_reserved DECIMAL;
  v_remaining DECIMAL;
BEGIN
  -- Lock the row for update (prevents concurrent modifications)
  SELECT 
    social_total_budget_usd,
    COALESCE(social_actual_budget_released, 0),
    COALESCE(social_reserved_budget, 0)
  INTO 
    v_total_budget,
    v_released,
    v_reserved
  FROM jobs
  WHERE id = p_job_id
    AND is_social_media_job = true
  FOR UPDATE;
  
  -- Check if job exists
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'job_not_found'
    );
  END IF;
  
  -- Calculate remaining budget
  -- Remaining = Total - (Released + Reserved)
  v_remaining := v_total_budget - (v_released + v_reserved);
  
  -- Check if enough budget available
  IF v_remaining < p_amount THEN
    RETURN json_build_object(
      'success', false,
      'error', 'insufficient_budget',
      'remaining', v_remaining,
      'requested', p_amount
    );
  END IF;
  
  -- Reserve the budget
  UPDATE jobs
  SET 
    social_reserved_budget = COALESCE(social_reserved_budget, 0) + p_amount,
    updated_at = NOW()
  WHERE id = p_job_id;
  
  -- Return success
  RETURN json_build_object(
    'success', true,
    'reserved', p_amount,
    'remaining', v_remaining - p_amount
  );
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log error and return failure
    RAISE WARNING 'Error in reserve_social_budget: %', SQLERRM;
    RETURN json_build_object(
      'success', false,
      'error', 'unexpected_error',
      'message', SQLERRM
    );
END;
$$;

-- Add comment
COMMENT ON FUNCTION reserve_social_budget IS 
  'Atomically reserves budget for social media job submissions. Uses row-level locking to prevent race conditions.';

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION reserve_social_budget TO authenticated;
GRANT EXECUTE ON FUNCTION reserve_social_budget TO anon;


/**
 * Unreserve Social Budget Function
 * 
 * Returns reserved budget back to available pool when submission is rejected.
 */

CREATE OR REPLACE FUNCTION unreserve_social_budget(
  p_job_id UUID,
  p_amount DECIMAL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update job to return reserved budget
  UPDATE jobs
  SET 
    social_reserved_budget = GREATEST(COALESCE(social_reserved_budget, 0) - p_amount, 0),
    updated_at = NOW()
  WHERE id = p_job_id
    AND is_social_media_job = true;
  
  -- Check if job was found
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'job_not_found'
    );
  END IF;
  
  -- Return success
  RETURN json_build_object(
    'success', true,
    'unreserved', p_amount
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in unreserve_social_budget: %', SQLERRM;
    RETURN json_build_object(
      'success', false,
      'error', 'unexpected_error',
      'message', SQLERRM
    );
END;
$$;

-- Add comment
COMMENT ON FUNCTION unreserve_social_budget IS 
  'Returns reserved budget back to available pool when submission is rejected.';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION unreserve_social_budget TO authenticated;
GRANT EXECUTE ON FUNCTION unreserve_social_budget TO anon;


/**
 * Release Social Budget Function
 * 
 * Moves budget from reserved to released when payment is made.
 */

CREATE OR REPLACE FUNCTION release_social_budget(
  p_job_id UUID,
  p_amount DECIMAL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Lock row and update budgets atomically
  UPDATE jobs
  SET 
    social_reserved_budget = GREATEST(COALESCE(social_reserved_budget, 0) - p_amount, 0),
    social_actual_budget_released = COALESCE(social_actual_budget_released, 0) + p_amount,
    updated_at = NOW()
  WHERE id = p_job_id
    AND is_social_media_job = true;
  
  -- Check if job was found
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'job_not_found'
    );
  END IF;
  
  -- Return success
  RETURN json_build_object(
    'success', true,
    'released', p_amount
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in release_social_budget: %', SQLERRM;
    RETURN json_build_object(
      'success', false,
      'error', 'unexpected_error',
      'message', SQLERRM
    );
END;
$$;

-- Add comment
COMMENT ON FUNCTION release_social_budget IS 
  'Moves budget from reserved to released when payment is made to worker.';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION release_social_budget TO authenticated;
GRANT EXECUTE ON FUNCTION release_social_budget TO anon;

