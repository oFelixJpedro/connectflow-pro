-- Add column for AI-generated detailed content
ALTER TABLE public.commercial_reports 
ADD COLUMN IF NOT EXISTS report_content JSONB DEFAULT '{}'::jsonb;

-- Add comment to explain the structure
COMMENT ON COLUMN public.commercial_reports.report_content IS 'AI-generated detailed report content with sections: executive_summary, period_overview, criteria_analysis, agents_detailed, strengths_detailed, weaknesses_detailed, insights_detailed, conclusion, next_steps';