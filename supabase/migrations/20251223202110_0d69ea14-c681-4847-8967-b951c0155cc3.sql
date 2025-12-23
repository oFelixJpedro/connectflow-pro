-- Add AI optimization settings column to companies table
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS ai_optimization_settings JSONB DEFAULT jsonb_build_object(
  'commercial_pixel_enabled', true,
  'behavior_analysis_enabled', true,
  'evaluation_frequency', 'on_close'
);

-- Add comment for documentation
COMMENT ON COLUMN public.companies.ai_optimization_settings IS 'AI optimization settings: commercial_pixel_enabled (boolean), behavior_analysis_enabled (boolean), evaluation_frequency (on_close|daily|disabled)';