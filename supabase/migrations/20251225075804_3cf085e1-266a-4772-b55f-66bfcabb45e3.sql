-- Alterar valor padrão da coluna ai_optimization_settings para novas empresas
ALTER TABLE public.companies
ALTER COLUMN ai_optimization_settings 
SET DEFAULT jsonb_build_object(
  'commercial_pixel_enabled', false,
  'behavior_analysis_enabled', false,
  'evaluation_frequency', 'disabled'
);

-- Atualizar empresas existentes que não têm commercial_manager_enabled
-- Isso corrige o estado inconsistente onde o pixel estava ativo mas o módulo não
UPDATE public.companies
SET ai_optimization_settings = jsonb_build_object(
  'commercial_pixel_enabled', false,
  'behavior_analysis_enabled', false,
  'evaluation_frequency', 'disabled'
)
WHERE commercial_manager_enabled = false 
   OR commercial_manager_enabled IS NULL;