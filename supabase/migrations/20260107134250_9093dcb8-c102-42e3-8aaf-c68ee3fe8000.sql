-- Create consume_ai_credits function to deduct tokens and log transaction
CREATE OR REPLACE FUNCTION public.consume_ai_credits(
  p_company_id UUID,
  p_credit_type TEXT,
  p_tokens BIGINT,
  p_function_name TEXT DEFAULT NULL,
  p_input_tokens BIGINT DEFAULT 0,
  p_output_tokens BIGINT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_column_name TEXT;
  v_current_balance BIGINT;
  v_new_balance BIGINT;
BEGIN
  -- Map credit type to column name
  CASE p_credit_type
    WHEN 'standard_text' THEN v_column_name := 'standard_text_tokens';
    WHEN 'advanced_text' THEN v_column_name := 'advanced_text_tokens';
    WHEN 'standard_audio' THEN v_column_name := 'standard_audio_tokens';
    WHEN 'advanced_audio' THEN v_column_name := 'advanced_audio_tokens';
    ELSE RAISE EXCEPTION 'Invalid credit type: %', p_credit_type;
  END CASE;

  -- Ensure credits record exists
  INSERT INTO ai_credits (company_id)
  VALUES (p_company_id)
  ON CONFLICT (company_id) DO NOTHING;

  -- Get current balance and deduct tokens in a single atomic operation
  EXECUTE format('
    UPDATE ai_credits 
    SET %I = GREATEST(0, COALESCE(%I, 0) - $1),
        updated_at = now()
    WHERE company_id = $2
    RETURNING %I
  ', v_column_name, v_column_name, v_column_name)
  INTO v_new_balance
  USING p_tokens, p_company_id;

  -- Log the transaction
  INSERT INTO ai_credit_transactions (
    company_id,
    transaction_type,
    credit_type,
    tokens_amount,
    tokens_balance_after,
    function_name,
    input_tokens,
    output_tokens,
    metadata
  ) VALUES (
    p_company_id,
    'usage',
    p_credit_type,
    -p_tokens,
    v_new_balance,
    p_function_name,
    p_input_tokens,
    p_output_tokens,
    jsonb_build_object('consumed_at', now())
  );

  RETURN jsonb_build_object(
    'success', true,
    'tokens_consumed', p_tokens,
    'new_balance', v_new_balance,
    'credit_type', p_credit_type
  );
END;
$$;