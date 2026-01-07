// =====================================================
// CREDIT VERIFICATION AND CONSUMPTION MODULE
// Used by AI Edge Functions to check and consume credits
// =====================================================

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type CreditType = 'standard_text' | 'advanced_text' | 'standard_audio' | 'advanced_audio';

// Credit type column mapping
const CREDIT_COLUMNS: Record<CreditType, string> = {
  standard_text: 'standard_text_tokens',
  advanced_text: 'advanced_text_tokens',
  standard_audio: 'standard_audio_tokens',
  advanced_audio: 'advanced_audio_tokens',
};

// Model to credit type mapping
export const MODEL_CREDIT_TYPE: Record<string, CreditType> = {
  // Standard text models
  'gemini-2.5-flash-lite': 'standard_text',
  'gemini-2.0-flash': 'standard_text',
  
  // Advanced text models
  'gemini-3-flash-preview': 'advanced_text',
  'gemini-2.5-flash': 'advanced_text',
  'gemini-2.5-flash-preview': 'advanced_text',
  'gemini-2.5-pro': 'advanced_text',
  'gemini-3-pro-preview': 'advanced_text',
  
  // Standard audio models (TTS)
  'gemini-2.5-flash-preview-tts': 'standard_audio',
  
  // Advanced audio models (TTS)
  'gemini-2.5-pro-preview-tts': 'advanced_audio',
};

export interface CreditCheckResult {
  hasCredits: boolean;
  currentBalance: number;
  creditType: CreditType;
  errorMessage?: string;
}

export interface CreditConsumeResult {
  success: boolean;
  tokensConsumed: number;
  newBalance: number;
  errorMessage?: string;
}

/**
 * Get the credit type for a given model
 */
export function getCreditTypeForModel(model: string, isAudio: boolean = false): CreditType {
  // If we have a direct mapping, use it
  if (MODEL_CREDIT_TYPE[model]) {
    return MODEL_CREDIT_TYPE[model];
  }
  
  // Default based on isAudio flag
  if (isAudio) {
    return 'standard_audio';
  }
  
  // Default to advanced_text for unknown text models (safer)
  return 'advanced_text';
}

/**
 * Check if a company has enough credits for an operation
 * @param supabase - Supabase client with service role
 * @param companyId - Company ID
 * @param creditType - Type of credit to check
 * @param tokensNeeded - Estimated tokens needed (optional, default 1000)
 */
export async function checkCredits(
  supabase: SupabaseClient,
  companyId: string,
  creditType: CreditType,
  tokensNeeded: number = 1000
): Promise<CreditCheckResult> {
  try {
    // First ensure credits record exists using the RPC
    const { data: creditsData, error: rpcError } = await supabase.rpc('check_ai_credits', {
      p_company_id: companyId
    });
    
    if (rpcError) {
      console.error('[Credits] RPC error:', rpcError);
      return {
        hasCredits: false,
        currentBalance: 0,
        creditType,
        errorMessage: 'Erro ao verificar créditos'
      };
    }
    
    // Get the balance from the result
    const balance = creditsData?.[CREDIT_COLUMNS[creditType]] || 0;
    
    return {
      hasCredits: balance >= tokensNeeded,
      currentBalance: balance,
      creditType,
      errorMessage: balance < tokensNeeded 
        ? `Créditos insuficientes de ${creditType}. Saldo: ${balance.toLocaleString()}, necessário: ${tokensNeeded.toLocaleString()}`
        : undefined
    };
  } catch (error) {
    console.error('[Credits] Exception checking credits:', error);
    return {
      hasCredits: false,
      currentBalance: 0,
      creditType,
      errorMessage: 'Erro ao verificar créditos'
    };
  }
}

/**
 * Consume credits after an AI operation completes
 * @param supabase - Supabase client with service role
 * @param companyId - Company ID
 * @param creditType - Type of credit to consume
 * @param tokensUsed - Actual tokens used
 * @param functionName - Name of the function consuming credits
 * @param inputTokens - Input tokens used
 * @param outputTokens - Output tokens used
 */
export async function consumeCredits(
  supabase: SupabaseClient,
  companyId: string,
  creditType: CreditType,
  tokensUsed: number,
  functionName: string,
  inputTokens: number = 0,
  outputTokens: number = 0
): Promise<CreditConsumeResult> {
  try {
    // Use the consume_ai_credits RPC function
    const { data, error } = await supabase.rpc('consume_ai_credits', {
      p_company_id: companyId,
      p_credit_type: creditType,
      p_tokens: tokensUsed,
      p_function_name: functionName,
      p_input_tokens: inputTokens,
      p_output_tokens: outputTokens
    });
    
    if (error) {
      console.error('[Credits] Consume error:', error);
      return {
        success: false,
        tokensConsumed: 0,
        newBalance: 0,
        errorMessage: error.message
      };
    }
    
    console.log(`[Credits] Consumed ${tokensUsed} ${creditType} tokens for ${functionName}`);
    
    return {
      success: true,
      tokensConsumed: tokensUsed,
      newBalance: data?.new_balance || 0
    };
  } catch (error) {
    console.error('[Credits] Exception consuming credits:', error);
    return {
      success: false,
      tokensConsumed: 0,
      newBalance: 0,
      errorMessage: 'Erro ao consumir créditos'
    };
  }
}

/**
 * Quick helper to check credits before an operation and return early if insufficient
 * Returns null if credits are OK, or an error Response if not
 */
export async function requireCredits(
  supabase: SupabaseClient,
  companyId: string,
  creditType: CreditType,
  corsHeaders: Record<string, string>,
  tokensNeeded: number = 1000
): Promise<Response | null> {
  const check = await checkCredits(supabase, companyId, creditType, tokensNeeded);
  
  if (!check.hasCredits) {
    console.warn(`[Credits] Insufficient ${creditType} credits for company ${companyId}`);
    return new Response(
      JSON.stringify({ 
        error: check.errorMessage,
        code: 'INSUFFICIENT_CREDITS',
        creditType,
        currentBalance: check.currentBalance,
        required: tokensNeeded
      }),
      { 
        status: 402, // Payment Required
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
  
  return null; // Credits OK, continue
}

/**
 * Determine which credit types to check based on agent configuration
 */
export function getAgentCreditTypes(
  aiModelType: 'standard' | 'advanced' = 'advanced',
  audioModelType: 'standard' | 'advanced' = 'standard',
  audioEnabled: boolean = false
): { textCreditType: CreditType; audioCreditType?: CreditType } {
  const textCreditType: CreditType = aiModelType === 'standard' ? 'standard_text' : 'advanced_text';
  const audioCreditType: CreditType | undefined = audioEnabled 
    ? (audioModelType === 'standard' ? 'standard_audio' : 'advanced_audio')
    : undefined;
    
  return { textCreditType, audioCreditType };
}
