-- Create insights_jobs table for async processing
CREATE TABLE public.insights_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Job configuration
  job_type TEXT NOT NULL DEFAULT 'filtered_insights',
  filters JSONB NOT NULL DEFAULT '{}',
  
  -- Status and progress
  status TEXT NOT NULL DEFAULT 'pending',
  progress INTEGER DEFAULT 0,
  current_step TEXT,
  
  -- Result
  result JSONB,
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- TTL (jobs expire in 24h)
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
);

-- Indexes for performance
CREATE INDEX idx_insights_jobs_company ON public.insights_jobs(company_id);
CREATE INDEX idx_insights_jobs_status ON public.insights_jobs(status);
CREATE INDEX idx_insights_jobs_expires ON public.insights_jobs(expires_at);

-- Enable RLS
ALTER TABLE public.insights_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their company jobs" ON public.insights_jobs
  FOR SELECT USING (company_id = get_user_company_id());

CREATE POLICY "Users can create jobs for their company" ON public.insights_jobs
  FOR INSERT WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "System can update jobs" ON public.insights_jobs
  FOR UPDATE USING (true);

CREATE POLICY "Admins can delete jobs" ON public.insights_jobs
  FOR DELETE USING (company_id = get_user_company_id() AND is_admin_or_owner());

-- Function to cleanup expired jobs (can be called periodically)
CREATE OR REPLACE FUNCTION public.cleanup_expired_insights_jobs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.insights_jobs
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;