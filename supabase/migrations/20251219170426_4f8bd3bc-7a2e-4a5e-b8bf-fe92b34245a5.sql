-- Add specialty metadata fields to ai_agents table
ALTER TABLE public.ai_agents
ADD COLUMN IF NOT EXISTS specialty_keywords text[] DEFAULT '{}'::text[],
ADD COLUMN IF NOT EXISTS qualification_summary text,
ADD COLUMN IF NOT EXISTS disqualification_signs text;

-- Add comments for documentation
COMMENT ON COLUMN public.ai_agents.specialty_keywords IS 'Keywords that identify this agent specialty/thesis (e.g., bpc, loas, idoso)';
COMMENT ON COLUMN public.ai_agents.qualification_summary IS 'Description of the ideal client profile for this agent specialty';
COMMENT ON COLUMN public.ai_agents.disqualification_signs IS 'Indicators that a lead does NOT fit this agent specialty';