-- Add aggregated insights fields to company_live_dashboard
ALTER TABLE public.company_live_dashboard 
ADD COLUMN IF NOT EXISTS aggregated_insights jsonb DEFAULT '{
  "strengths": [],
  "weaknesses": [],
  "positive_patterns": [],
  "negative_patterns": [],
  "critical_issues": [],
  "insights": [],
  "final_recommendation": "",
  "criteria_scores": {
    "communication": 0,
    "objectivity": 0,
    "humanization": 0,
    "objection_handling": 0,
    "closing": 0,
    "response_time": 0
  },
  "average_score": 0,
  "qualified_leads_percent": 0
}'::jsonb;

ALTER TABLE public.company_live_dashboard 
ADD COLUMN IF NOT EXISTS last_insights_update timestamp with time zone DEFAULT now();

ALTER TABLE public.company_live_dashboard 
ADD COLUMN IF NOT EXISTS insights_message_count integer DEFAULT 0;

-- Enable realtime for company_live_dashboard if not already enabled
ALTER TABLE public.company_live_dashboard REPLICA IDENTITY FULL;

-- Add table to realtime publication if needed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'company_live_dashboard'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.company_live_dashboard;
  END IF;
END $$;