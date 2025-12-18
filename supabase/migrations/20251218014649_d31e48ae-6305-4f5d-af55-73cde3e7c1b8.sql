-- Add batching and response splitting configuration fields to ai_agents table
ALTER TABLE public.ai_agents
ADD COLUMN IF NOT EXISTS message_batch_seconds integer DEFAULT 75,
ADD COLUMN IF NOT EXISTS split_response_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS split_message_delay_seconds numeric DEFAULT 2.0;

-- Add comments for documentation
COMMENT ON COLUMN public.ai_agents.message_batch_seconds IS 'Time in seconds to wait for additional messages before processing (debounce)';
COMMENT ON COLUMN public.ai_agents.split_response_enabled IS 'Whether to split AI responses into multiple WhatsApp messages';
COMMENT ON COLUMN public.ai_agents.split_message_delay_seconds IS 'Delay in seconds between each split message';