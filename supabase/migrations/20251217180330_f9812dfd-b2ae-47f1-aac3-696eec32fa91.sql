-- Add audio_temperature column to ai_agents table
ALTER TABLE public.ai_agents 
ADD COLUMN IF NOT EXISTS audio_temperature numeric DEFAULT 0.7;

-- Add comment explaining the column
COMMENT ON COLUMN public.ai_agents.audio_temperature IS 'Audio TTS temperature (0.0 = consistent, 1.0 = varied). Default 0.7';