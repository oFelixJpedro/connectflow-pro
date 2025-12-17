-- Add temperature column to ai_agents table
ALTER TABLE public.ai_agents 
ADD COLUMN IF NOT EXISTS temperature numeric DEFAULT 0.7;

-- Add comment explaining the column
COMMENT ON COLUMN public.ai_agents.temperature IS 'AI response temperature (0.0 = precise, 1.0 = creative). Default 0.7';

-- Normalize existing speech_speed values to valid options (0.7, 1.0, 1.2)
UPDATE public.ai_agents 
SET speech_speed = 
  CASE 
    WHEN speech_speed <= 0.85 THEN 0.7
    WHEN speech_speed >= 1.1 THEN 1.2
    ELSE 1.0
  END
WHERE speech_speed IS NOT NULL 
  AND speech_speed NOT IN (0.7, 1.0, 1.2);