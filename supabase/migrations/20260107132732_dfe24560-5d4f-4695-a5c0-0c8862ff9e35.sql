-- =============================================
-- AI Credits System - Complete Migration
-- =============================================

-- 1. Create ai_credits table for storing company credit balances
CREATE TABLE public.ai_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  
  -- Text AI credits (1M tokens = full credit)
  standard_text_tokens BIGINT DEFAULT 0,  -- gemini-2.5-flash-lite
  advanced_text_tokens BIGINT DEFAULT 0,  -- gemini-3-flash-preview
  
  -- Audio TTS credits (1M tokens = full credit)
  standard_audio_tokens BIGINT DEFAULT 0,  -- gemini-2.5-flash-preview-tts
  advanced_audio_tokens BIGINT DEFAULT 0,  -- gemini-2.5-pro-preview-tts
  
  -- Auto-recharge settings
  auto_recharge_enabled BOOLEAN DEFAULT FALSE,
  auto_recharge_threshold INTEGER DEFAULT 50000,  -- tokens threshold
  auto_recharge_types TEXT[] DEFAULT '{}',  -- which types to auto-recharge
  
  -- Stripe payment method for auto-recharge
  stripe_payment_method_id TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- One record per company
  CONSTRAINT ai_credits_company_unique UNIQUE(company_id)
);

-- 2. Create ai_credit_transactions table for logging all transactions
CREATE TABLE public.ai_credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  
  -- Transaction type
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('purchase', 'usage', 'auto_recharge', 'refund')),
  credit_type TEXT NOT NULL CHECK (credit_type IN ('standard_text', 'advanced_text', 'standard_audio', 'advanced_audio')),
  
  -- Token amounts
  tokens_amount BIGINT NOT NULL,  -- positive for purchase, negative for usage
  tokens_balance_after BIGINT NOT NULL,
  
  -- Stripe info (for purchases)
  stripe_payment_intent_id TEXT,
  stripe_checkout_session_id TEXT,
  amount_paid_cents INTEGER,  -- in BRL cents
  
  -- Usage info (for consumption)
  function_name TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Add model type columns to ai_agents table
ALTER TABLE public.ai_agents 
  ADD COLUMN IF NOT EXISTS ai_model_type TEXT DEFAULT 'standard' CHECK (ai_model_type IN ('standard', 'advanced')),
  ADD COLUMN IF NOT EXISTS audio_model_type TEXT DEFAULT 'standard' CHECK (audio_model_type IN ('standard', 'advanced'));

-- 4. Enable RLS on new tables
ALTER TABLE public.ai_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_credit_transactions ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies for ai_credits
CREATE POLICY "Users can view own company credits" ON public.ai_credits
  FOR SELECT USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can update own company credits" ON public.ai_credits
  FOR UPDATE USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can insert own company credits" ON public.ai_credits
  FOR INSERT WITH CHECK (company_id = public.get_user_company_id());

-- 6. Create RLS policies for ai_credit_transactions
CREATE POLICY "Users can view own company transactions" ON public.ai_credit_transactions
  FOR SELECT USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can insert own company transactions" ON public.ai_credit_transactions
  FOR INSERT WITH CHECK (company_id = public.get_user_company_id());

-- 7. Create indexes for performance
CREATE INDEX idx_ai_credits_company ON public.ai_credits(company_id);
CREATE INDEX idx_ai_credit_tx_company ON public.ai_credit_transactions(company_id);
CREATE INDEX idx_ai_credit_tx_created ON public.ai_credit_transactions(created_at DESC);
CREATE INDEX idx_ai_credit_tx_type ON public.ai_credit_transactions(credit_type);
CREATE INDEX idx_ai_credit_tx_transaction_type ON public.ai_credit_transactions(transaction_type);

-- 8. Create function to consume AI credits
CREATE OR REPLACE FUNCTION public.consume_ai_credits(
  p_company_id UUID,
  p_credit_type TEXT,
  p_tokens INTEGER,
  p_function_name TEXT DEFAULT NULL,
  p_input_tokens INTEGER DEFAULT NULL,
  p_output_tokens INTEGER DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance BIGINT;
  v_new_balance BIGINT;
  v_column_name TEXT;
  v_credits_record ai_credits%ROWTYPE;
BEGIN
  -- Validate credit type
  IF p_credit_type NOT IN ('standard_text', 'advanced_text', 'standard_audio', 'advanced_audio') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid credit type');
  END IF;
  
  -- Determine column name based on credit type
  v_column_name := CASE p_credit_type
    WHEN 'standard_text' THEN 'standard_text_tokens'
    WHEN 'advanced_text' THEN 'advanced_text_tokens'
    WHEN 'standard_audio' THEN 'standard_audio_tokens'
    WHEN 'advanced_audio' THEN 'advanced_audio_tokens'
  END;
  
  -- Get current credits with lock
  SELECT * INTO v_credits_record
  FROM ai_credits
  WHERE company_id = p_company_id
  FOR UPDATE;
  
  -- If no credits record exists, return error
  IF v_credits_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No credits record found', 'balance', 0);
  END IF;
  
  -- Get current balance based on type
  v_current_balance := CASE p_credit_type
    WHEN 'standard_text' THEN v_credits_record.standard_text_tokens
    WHEN 'advanced_text' THEN v_credits_record.advanced_text_tokens
    WHEN 'standard_audio' THEN v_credits_record.standard_audio_tokens
    WHEN 'advanced_audio' THEN v_credits_record.advanced_audio_tokens
  END;
  
  -- Check if sufficient credits
  IF v_current_balance < p_tokens THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient credits', 'balance', v_current_balance, 'required', p_tokens);
  END IF;
  
  -- Calculate new balance
  v_new_balance := v_current_balance - p_tokens;
  
  -- Update credits
  EXECUTE format('
    UPDATE ai_credits 
    SET %I = $1,
        updated_at = NOW()
    WHERE company_id = $2', v_column_name)
  USING v_new_balance, p_company_id;
  
  -- Log transaction
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
    p_metadata
  );
  
  RETURN jsonb_build_object(
    'success', true, 
    'tokens_consumed', p_tokens, 
    'balance_after', v_new_balance,
    'should_auto_recharge', v_credits_record.auto_recharge_enabled AND v_new_balance <= v_credits_record.auto_recharge_threshold AND p_credit_type = ANY(v_credits_record.auto_recharge_types)
  );
END;
$$;

-- 9. Create function to add AI credits (for purchases)
CREATE OR REPLACE FUNCTION public.add_ai_credits(
  p_company_id UUID,
  p_credit_type TEXT,
  p_tokens BIGINT,
  p_transaction_type TEXT DEFAULT 'purchase',
  p_stripe_checkout_session_id TEXT DEFAULT NULL,
  p_stripe_payment_intent_id TEXT DEFAULT NULL,
  p_amount_paid_cents INTEGER DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance BIGINT;
  v_column_name TEXT;
BEGIN
  -- Validate credit type
  IF p_credit_type NOT IN ('standard_text', 'advanced_text', 'standard_audio', 'advanced_audio') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid credit type');
  END IF;
  
  -- Determine column name
  v_column_name := CASE p_credit_type
    WHEN 'standard_text' THEN 'standard_text_tokens'
    WHEN 'advanced_text' THEN 'advanced_text_tokens'
    WHEN 'standard_audio' THEN 'standard_audio_tokens'
    WHEN 'advanced_audio' THEN 'advanced_audio_tokens'
  END;
  
  -- Ensure credits record exists
  INSERT INTO ai_credits (company_id)
  VALUES (p_company_id)
  ON CONFLICT (company_id) DO NOTHING;
  
  -- Add tokens and get new balance
  EXECUTE format('
    UPDATE ai_credits 
    SET %I = %I + $1,
        updated_at = NOW()
    WHERE company_id = $2
    RETURNING %I', v_column_name, v_column_name, v_column_name)
  INTO v_new_balance
  USING p_tokens, p_company_id;
  
  -- Log transaction
  INSERT INTO ai_credit_transactions (
    company_id, 
    transaction_type, 
    credit_type,
    tokens_amount, 
    tokens_balance_after, 
    stripe_checkout_session_id,
    stripe_payment_intent_id,
    amount_paid_cents,
    metadata
  ) VALUES (
    p_company_id, 
    p_transaction_type, 
    p_credit_type,
    p_tokens, 
    v_new_balance, 
    p_stripe_checkout_session_id,
    p_stripe_payment_intent_id,
    p_amount_paid_cents,
    p_metadata
  );
  
  RETURN jsonb_build_object('success', true, 'tokens_added', p_tokens, 'balance_after', v_new_balance);
END;
$$;

-- 10. Create function to check credits balance
CREATE OR REPLACE FUNCTION public.check_ai_credits(
  p_company_id UUID,
  p_credit_type TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credits_record ai_credits%ROWTYPE;
BEGIN
  SELECT * INTO v_credits_record
  FROM ai_credits
  WHERE company_id = p_company_id;
  
  IF v_credits_record IS NULL THEN
    -- Create default record if not exists
    INSERT INTO ai_credits (company_id)
    VALUES (p_company_id)
    ON CONFLICT (company_id) DO NOTHING;
    
    RETURN jsonb_build_object(
      'standard_text', 0,
      'advanced_text', 0,
      'standard_audio', 0,
      'advanced_audio', 0,
      'auto_recharge_enabled', false,
      'auto_recharge_threshold', 50000
    );
  END IF;
  
  -- Return specific type or all
  IF p_credit_type IS NOT NULL THEN
    RETURN jsonb_build_object(
      'balance', CASE p_credit_type
        WHEN 'standard_text' THEN v_credits_record.standard_text_tokens
        WHEN 'advanced_text' THEN v_credits_record.advanced_text_tokens
        WHEN 'standard_audio' THEN v_credits_record.standard_audio_tokens
        WHEN 'advanced_audio' THEN v_credits_record.advanced_audio_tokens
        ELSE 0
      END
    );
  END IF;
  
  RETURN jsonb_build_object(
    'standard_text', v_credits_record.standard_text_tokens,
    'advanced_text', v_credits_record.advanced_text_tokens,
    'standard_audio', v_credits_record.standard_audio_tokens,
    'advanced_audio', v_credits_record.advanced_audio_tokens,
    'auto_recharge_enabled', v_credits_record.auto_recharge_enabled,
    'auto_recharge_threshold', v_credits_record.auto_recharge_threshold,
    'auto_recharge_types', v_credits_record.auto_recharge_types
  );
END;
$$;

-- 11. Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION public.consume_ai_credits TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.add_ai_credits TO service_role;
GRANT EXECUTE ON FUNCTION public.check_ai_credits TO authenticated, service_role;

-- 12. Create trigger to update timestamps
CREATE OR REPLACE FUNCTION public.update_ai_credits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ai_credits_updated_at
  BEFORE UPDATE ON public.ai_credits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ai_credits_updated_at();