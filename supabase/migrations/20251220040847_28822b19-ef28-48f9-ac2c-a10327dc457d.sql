-- Alterar temperatura padrão de 0.7 para 1.0
ALTER TABLE public.ai_agents 
ALTER COLUMN temperature SET DEFAULT 1.0;

-- Também alterar audio_temperature para consistência
ALTER TABLE public.ai_agents 
ALTER COLUMN audio_temperature SET DEFAULT 1.0;