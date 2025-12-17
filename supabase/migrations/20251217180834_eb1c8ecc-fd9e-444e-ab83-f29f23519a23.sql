-- Add language_code column to ai_agents table
ALTER TABLE public.ai_agents
ADD COLUMN language_code text DEFAULT 'pt-BR';