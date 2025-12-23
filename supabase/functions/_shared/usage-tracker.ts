// Usage Tracker - Logs AI usage to ai_usage_log table
// Used by all AI-related edge functions

// Gemini pricing per 1M tokens (as of 2024)
export const GEMINI_PRICING: Record<string, { input: number; output: number }> = {
  'gemini-2.5-flash': { input: 0.075, output: 0.30 },
  'gemini-2.5-flash-preview': { input: 0.075, output: 0.30 },
  'gemini-3-flash-preview': { input: 0.10, output: 0.40 },
  'gemini-2.5-pro': { input: 1.25, output: 10.00 },
  'gemini-1.5-flash': { input: 0.075, output: 0.30 },
  'gemini-1.5-pro': { input: 1.25, output: 5.00 },
  'default': { input: 0.10, output: 0.40 }
};

export function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = GEMINI_PRICING[model] || GEMINI_PRICING.default;
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}

export async function logAIUsage(
  supabaseClient: any,
  companyId: string,
  functionName: string,
  model: string,
  inputTokens: number = 0,
  outputTokens: number = 0,
  processingTimeMs: number = 0,
  metadata: Record<string, any> = {}
): Promise<void> {
  try {
    const estimatedCost = calculateCost(model, inputTokens, outputTokens);

    const { error } = await supabaseClient
      .from('ai_usage_log')
      .insert({
        company_id: companyId,
        function_name: functionName,
        model: model,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        estimated_cost: estimatedCost,
        processing_time_ms: processingTimeMs,
        metadata: metadata
      });

    if (error) {
      console.error('[UsageTracker] Error logging usage:', error);
    } else {
      console.log(`[UsageTracker] Logged: ${functionName} | ${inputTokens} in / ${outputTokens} out | $${estimatedCost.toFixed(6)}`);
    }
  } catch (e) {
    console.error('[UsageTracker] Exception:', e);
  }
}

// Extract token usage from Gemini API response
export function extractGeminiUsage(response: any): { inputTokens: number; outputTokens: number } {
  // Gemini returns usage in usageMetadata
  const usageMetadata = response?.usageMetadata;
  if (usageMetadata) {
    return {
      inputTokens: usageMetadata.promptTokenCount || 0,
      outputTokens: usageMetadata.candidatesTokenCount || 0
    };
  }
  
  // Fallback: estimate from response length
  const text = response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return {
    inputTokens: 0, // Can't estimate input
    outputTokens: Math.ceil(text.length / 4) // Rough estimate: 4 chars per token
  };
}
