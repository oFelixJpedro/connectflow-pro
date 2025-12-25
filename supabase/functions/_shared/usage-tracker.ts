// Usage Tracker - Logs AI usage to ai_usage_log table
// Used by all AI-related edge functions
// Updated December 2024 with correct Gemini pricing and audio differentiation

// Gemini pricing per 1M tokens (Updated December 2024)
// Sources: https://ai.google.dev/pricing
export const GEMINI_PRICING: Record<string, { 
  inputText: number;      // Price for text/image/video input
  inputAudio: number;     // Price for audio input (2x-3.3x higher)
  output: number;         // Output price
}> = {
  // Gemini 3 models (latest)
  'gemini-3-flash-preview': { inputText: 0.50, inputAudio: 1.00, output: 3.00 },
  'gemini-3-pro-preview': { inputText: 2.00, inputAudio: 4.00, output: 12.00 },
  
  // Gemini 2.5 models
  'gemini-2.5-flash': { inputText: 0.30, inputAudio: 1.00, output: 2.50 },
  'gemini-2.5-flash-preview': { inputText: 0.30, inputAudio: 1.00, output: 2.50 },
  'gemini-2.5-flash-lite': { inputText: 0.10, inputAudio: 0.30, output: 0.40 },
  'gemini-2.5-pro': { inputText: 1.25, inputAudio: 2.50, output: 10.00 },
  'gemini-2.5-pro-preview-tts': { inputText: 1.25, inputAudio: 2.50, output: 10.00 },
  
  // Gemini 2.0 models
  'gemini-2.0-flash': { inputText: 0.10, inputAudio: 0.70, output: 0.40 },
  
  // Gemini 1.5 models (legacy)
  'gemini-1.5-flash': { inputText: 0.075, inputAudio: 0.075, output: 0.30 },
  'gemini-1.5-pro': { inputText: 1.25, inputAudio: 1.25, output: 5.00 },
  
  // Default fallback (use Gemini 3 Flash pricing as default)
  'default': { inputText: 0.50, inputAudio: 1.00, output: 3.00 }
};

/**
 * Calculate estimated cost based on token usage
 * @param model - The Gemini model name
 * @param inputTokens - Number of input tokens
 * @param outputTokens - Number of output tokens
 * @param isAudioInput - Whether the input contains audio (uses higher pricing)
 * @returns Estimated cost in USD
 */
export function calculateCost(
  model: string, 
  inputTokens: number, 
  outputTokens: number,
  isAudioInput: boolean = false
): number {
  const pricing = GEMINI_PRICING[model] || GEMINI_PRICING.default;
  const inputPrice = isAudioInput ? pricing.inputAudio : pricing.inputText;
  const inputCost = (inputTokens / 1_000_000) * inputPrice;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}

/**
 * Log AI usage to the database for cost tracking
 * @param supabaseClient - Supabase client instance
 * @param companyId - Company ID
 * @param functionName - Edge function name
 * @param model - Gemini model name
 * @param inputTokens - Number of input tokens
 * @param outputTokens - Number of output tokens
 * @param processingTimeMs - Processing time in milliseconds
 * @param metadata - Additional metadata
 * @param isAudioInput - Whether input contains audio (for accurate pricing)
 */
export async function logAIUsage(
  supabaseClient: any,
  companyId: string,
  functionName: string,
  model: string,
  inputTokens: number = 0,
  outputTokens: number = 0,
  processingTimeMs: number = 0,
  metadata: Record<string, any> = {},
  isAudioInput: boolean = false
): Promise<void> {
  try {
    const estimatedCost = calculateCost(model, inputTokens, outputTokens, isAudioInput);

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
        metadata: { ...metadata, is_audio_input: isAudioInput }
      });

    if (error) {
      console.error('[UsageTracker] Error logging usage:', error);
    } else {
      const inputType = isAudioInput ? 'audio' : 'text/visual';
      console.log(`[UsageTracker] Logged: ${functionName} | ${inputTokens} in (${inputType}) / ${outputTokens} out | $${estimatedCost.toFixed(6)}`);
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

/**
 * Helper to detect if content contains audio
 * @param messageType - Type of message (audio, ptt, etc.)
 * @param mimeType - MIME type of the content
 * @returns true if content is audio
 */
export function isAudioContent(messageType?: string, mimeType?: string): boolean {
  if (!messageType && !mimeType) return false;
  
  const audioTypes = ['audio', 'ptt', 'voice'];
  const audioMimes = ['audio/', 'application/ogg'];
  
  if (messageType && audioTypes.some(t => messageType.toLowerCase().includes(t))) {
    return true;
  }
  
  if (mimeType && audioMimes.some(m => mimeType.toLowerCase().includes(m))) {
    return true;
  }
  
  return false;
}
