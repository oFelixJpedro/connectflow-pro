-- Table to log each AI call with tokens and cost
CREATE TABLE public.ai_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  function_name TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  estimated_cost DECIMAL(10,6) DEFAULT 0,
  processing_time_ms INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_ai_usage_log_company ON public.ai_usage_log(company_id);
CREATE INDEX idx_ai_usage_log_created ON public.ai_usage_log(created_at);
CREATE INDEX idx_ai_usage_log_function ON public.ai_usage_log(function_name);

-- Table for daily aggregated metrics
CREATE TABLE public.usage_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  
  -- AI Metrics
  ai_requests INTEGER DEFAULT 0,
  ai_input_tokens INTEGER DEFAULT 0,
  ai_output_tokens INTEGER DEFAULT 0,
  ai_estimated_cost DECIMAL(10,6) DEFAULT 0,
  
  -- Database Metrics
  db_rows_messages INTEGER DEFAULT 0,
  db_rows_conversations INTEGER DEFAULT 0,
  db_size_bytes BIGINT DEFAULT 0,
  
  -- Storage Metrics
  storage_files_count INTEGER DEFAULT 0,
  storage_bytes BIGINT DEFAULT 0,
  
  -- Activity Metrics
  messages_sent INTEGER DEFAULT 0,
  messages_received INTEGER DEFAULT 0,
  active_users INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, metric_date)
);

CREATE INDEX idx_usage_metrics_company ON public.usage_metrics(company_id);
CREATE INDEX idx_usage_metrics_date ON public.usage_metrics(metric_date);

-- Enable RLS
ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_usage_log
CREATE POLICY "System can insert AI usage logs"
  ON public.ai_usage_log
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can read AI usage logs"
  ON public.ai_usage_log
  FOR SELECT
  USING (true);

-- RLS Policies for usage_metrics
CREATE POLICY "System can manage usage metrics"
  ON public.usage_metrics
  FOR ALL
  USING (true)
  WITH CHECK (true);