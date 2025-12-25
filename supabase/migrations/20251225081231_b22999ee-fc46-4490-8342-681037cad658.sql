-- Add is_audio_input column to ai_usage_log for tracking audio-based costs
ALTER TABLE public.ai_usage_log 
ADD COLUMN IF NOT EXISTS is_audio_input boolean DEFAULT false;

-- Create index for faster filtering by audio type
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_is_audio_input 
ON public.ai_usage_log(is_audio_input) 
WHERE is_audio_input = true;

-- Recalculate estimated_cost for historical entries with updated Gemini pricing
-- New prices (per 1M tokens):
-- gemini-3-flash-preview: text $0.50 in / $3.00 out, audio $1.00 in / $3.00 out
-- gemini-2.5-flash: text $0.30 in / $2.50 out, audio $1.00 in / $2.50 out

-- Step 1: Mark historical audio entries
UPDATE public.ai_usage_log 
SET is_audio_input = true 
WHERE function_name = 'transcribe-audio'
AND is_audio_input = false;

-- Step 2: Update entries in metadata that indicate audio
UPDATE public.ai_usage_log 
SET is_audio_input = true 
WHERE (metadata->>'message_type' IN ('audio', 'ptt', 'voice')
   OR metadata->'mediaAnalyzed'->>'audios' IS NOT NULL 
   AND (metadata->'mediaAnalyzed'->>'audios')::int > 0)
AND is_audio_input = false;

-- Step 3: Recalculate costs for gemini-3-flash-preview (most common model)
-- Audio input: $1.00/1M tokens input, $3.00/1M tokens output
UPDATE public.ai_usage_log
SET estimated_cost = 
  CASE 
    WHEN is_audio_input = true THEN
      (input_tokens / 1000000.0 * 1.00) + (output_tokens / 1000000.0 * 3.00)
    ELSE
      (input_tokens / 1000000.0 * 0.50) + (output_tokens / 1000000.0 * 3.00)
  END
WHERE model = 'gemini-3-flash-preview';

-- Step 4: Recalculate costs for gemini-2.5-flash
UPDATE public.ai_usage_log
SET estimated_cost = 
  CASE 
    WHEN is_audio_input = true THEN
      (input_tokens / 1000000.0 * 1.00) + (output_tokens / 1000000.0 * 2.50)
    ELSE
      (input_tokens / 1000000.0 * 0.30) + (output_tokens / 1000000.0 * 2.50)
  END
WHERE model IN ('gemini-2.5-flash', 'gemini-2.5-flash-preview');

-- Step 5: Recalculate costs for gemini-2.5-pro
UPDATE public.ai_usage_log
SET estimated_cost = 
  CASE 
    WHEN is_audio_input = true THEN
      (input_tokens / 1000000.0 * 2.50) + (output_tokens / 1000000.0 * 10.00)
    ELSE
      (input_tokens / 1000000.0 * 1.25) + (output_tokens / 1000000.0 * 10.00)
  END
WHERE model IN ('gemini-2.5-pro', 'gemini-2.5-pro-preview-tts');

-- Step 6: Recalculate costs for gemini-1.5-flash (legacy)
UPDATE public.ai_usage_log
SET estimated_cost = 
  (input_tokens / 1000000.0 * 0.075) + (output_tokens / 1000000.0 * 0.30)
WHERE model = 'gemini-1.5-flash';

-- Step 7: Recalculate costs for gemini-1.5-pro (legacy)
UPDATE public.ai_usage_log
SET estimated_cost = 
  (input_tokens / 1000000.0 * 1.25) + (output_tokens / 1000000.0 * 5.00)
WHERE model = 'gemini-1.5-pro';

-- Add comment explaining the column
COMMENT ON COLUMN public.ai_usage_log.is_audio_input IS 'Whether the input contained audio content (uses higher pricing tier)';