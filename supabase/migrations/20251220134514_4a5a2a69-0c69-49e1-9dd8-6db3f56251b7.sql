-- Add columns for anticipated report functionality
ALTER TABLE public.commercial_reports
ADD COLUMN IF NOT EXISTS is_anticipated BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS anticipated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS anticipated_by UUID REFERENCES auth.users(id);

-- Create index for faster lookup of anticipated reports by week
CREATE INDEX IF NOT EXISTS idx_commercial_reports_anticipated 
ON public.commercial_reports(company_id, week_start, is_anticipated) 
WHERE is_anticipated = true;