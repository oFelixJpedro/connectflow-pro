-- Create table for caching media analysis results
CREATE TABLE public.media_analysis_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url_hash TEXT NOT NULL,
  url TEXT NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  media_type TEXT NOT NULL,
  analysis_result JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
  hit_count INTEGER DEFAULT 0
);

-- Create indexes for fast lookups
CREATE INDEX idx_media_cache_hash ON public.media_analysis_cache(url_hash);
CREATE INDEX idx_media_cache_company ON public.media_analysis_cache(company_id);
CREATE INDEX idx_media_cache_expires ON public.media_analysis_cache(expires_at);
CREATE UNIQUE INDEX idx_media_cache_unique ON public.media_analysis_cache(url_hash, company_id);

-- Enable RLS
ALTER TABLE public.media_analysis_cache ENABLE ROW LEVEL SECURITY;

-- System can manage cache (for edge functions)
CREATE POLICY "System can manage media cache" ON public.media_analysis_cache
  FOR ALL USING (true) WITH CHECK (true);

-- Create function to increment hit count
CREATE OR REPLACE FUNCTION public.increment_cache_hit(p_url_hash TEXT, p_company_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.media_analysis_cache
  SET hit_count = hit_count + 1
  WHERE url_hash = p_url_hash AND company_id = p_company_id;
END;
$$;

-- Create function to clean expired cache entries (can be called by cron job)
CREATE OR REPLACE FUNCTION public.cleanup_expired_media_cache()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.media_analysis_cache
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;