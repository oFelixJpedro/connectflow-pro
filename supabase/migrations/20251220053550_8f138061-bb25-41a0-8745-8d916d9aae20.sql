-- Create commercial_reports table
CREATE TABLE public.commercial_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  report_date DATE NOT NULL,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  
  -- Quality Metrics
  average_score DECIMAL(3,1),
  classification TEXT CHECK (classification IN ('EXCEPCIONAL', 'BOM', 'REGULAR', 'RUIM', 'CRÍTICO')),
  
  -- Criteria Scores
  criteria_scores JSONB DEFAULT '{}'::jsonb,
  
  -- AI Insights
  strengths TEXT[] DEFAULT '{}',
  weaknesses TEXT[] DEFAULT '{}',
  positive_patterns TEXT[] DEFAULT '{}',
  negative_patterns TEXT[] DEFAULT '{}',
  insights TEXT[] DEFAULT '{}',
  critical_issues TEXT[] DEFAULT '{}',
  final_recommendation TEXT,
  
  -- Quantitative Metrics
  total_conversations INTEGER DEFAULT 0,
  total_leads INTEGER DEFAULT 0,
  qualified_leads INTEGER DEFAULT 0,
  closed_deals INTEGER DEFAULT 0,
  conversion_rate DECIMAL(5,2) DEFAULT 0,
  avg_response_time_minutes INTEGER DEFAULT 0,
  
  -- Geographic Data
  contacts_by_state JSONB DEFAULT '{}'::jsonb,
  deals_by_state JSONB DEFAULT '{}'::jsonb,
  
  -- Agent Performance
  agents_analysis JSONB DEFAULT '[]'::jsonb,
  
  -- PDF and Metadata
  pdf_url TEXT,
  generated_by UUID REFERENCES profiles(id),
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(company_id, report_date)
);

-- Create conversation_evaluations table
CREATE TABLE public.conversation_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Scores (0-10)
  overall_score DECIMAL(3,1),
  communication_score DECIMAL(3,1),
  objectivity_score DECIMAL(3,1),
  humanization_score DECIMAL(3,1),
  objection_handling_score DECIMAL(3,1),
  closing_score DECIMAL(3,1),
  response_time_score DECIMAL(3,1),
  
  -- Lead Qualification
  lead_qualification TEXT CHECK (lead_qualification IN ('hot', 'warm', 'cold', 'disqualified')),
  lead_interest_level INTEGER CHECK (lead_interest_level >= 1 AND lead_interest_level <= 5),
  lead_pain_points TEXT[] DEFAULT '{}',
  
  -- Analysis
  strengths TEXT[] DEFAULT '{}',
  improvements TEXT[] DEFAULT '{}',
  ai_summary TEXT,
  
  -- Metadata
  evaluated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(conversation_id)
);

-- Enable RLS on commercial_reports
ALTER TABLE public.commercial_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for commercial_reports
CREATE POLICY "Admins can view reports in their company"
ON public.commercial_reports
FOR SELECT
USING (company_id = get_user_company_id() AND is_admin_or_owner());

CREATE POLICY "System can insert reports"
ON public.commercial_reports
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can delete reports"
ON public.commercial_reports
FOR DELETE
USING (company_id = get_user_company_id() AND is_admin_or_owner());

-- Enable RLS on conversation_evaluations
ALTER TABLE public.conversation_evaluations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for conversation_evaluations
CREATE POLICY "Admins can view evaluations in their company"
ON public.conversation_evaluations
FOR SELECT
USING (company_id = get_user_company_id() AND is_admin_or_owner());

CREATE POLICY "System can insert evaluations"
ON public.conversation_evaluations
FOR INSERT
WITH CHECK (true);

CREATE POLICY "System can update evaluations"
ON public.conversation_evaluations
FOR UPDATE
USING (true);

-- Create indexes for performance
CREATE INDEX idx_commercial_reports_company_date ON public.commercial_reports(company_id, report_date DESC);
CREATE INDEX idx_conversation_evaluations_company ON public.conversation_evaluations(company_id);
CREATE INDEX idx_conversation_evaluations_conversation ON public.conversation_evaluations(conversation_id);

-- Create storage bucket for reports PDFs
INSERT INTO storage.buckets (id, name, public) 
VALUES ('commercial-reports', 'commercial-reports', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for commercial-reports bucket
CREATE POLICY "Admins can view report PDFs"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'commercial-reports' 
  AND auth.uid() IS NOT NULL
  AND is_admin_or_owner()
);

CREATE POLICY "System can upload report PDFs"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'commercial-reports');

CREATE POLICY "Admins can download report PDFs"
ON storage.objects
FOR SELECT
USING (bucket_id = 'commercial-reports' AND is_admin_or_owner());