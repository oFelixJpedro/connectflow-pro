-- Tabela para tracking de uso do Supabase (storage, database operations, edge functions)
CREATE TABLE public.supabase_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  company_id UUID REFERENCES public.companies(id),
  resource_type TEXT NOT NULL, -- 'database', 'storage', 'edge_function', 'realtime', 'auth'
  operation_type TEXT NOT NULL, -- 'read', 'write', 'delete', 'invoke', 'upload', 'download'
  table_name TEXT, -- para operações de database
  function_name TEXT, -- para edge functions
  bucket_name TEXT, -- para storage
  row_count INTEGER DEFAULT 0,
  bytes_processed BIGINT DEFAULT 0,
  duration_ms INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Índices para consultas eficientes
CREATE INDEX idx_supabase_usage_log_created_at ON public.supabase_usage_log(created_at DESC);
CREATE INDEX idx_supabase_usage_log_company_id ON public.supabase_usage_log(company_id);
CREATE INDEX idx_supabase_usage_log_resource_type ON public.supabase_usage_log(resource_type);

-- Enable RLS
ALTER TABLE public.supabase_usage_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies: apenas sistema pode inserir, developers podem ler tudo
CREATE POLICY "System can insert usage logs" ON public.supabase_usage_log
FOR INSERT WITH CHECK (true);

CREATE POLICY "System can read usage logs" ON public.supabase_usage_log
FOR SELECT USING (true);

-- Função para limpeza de logs antigos (manter últimos 90 dias)
CREATE OR REPLACE FUNCTION public.cleanup_old_usage_logs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.supabase_usage_log
  WHERE created_at < NOW() - INTERVAL '90 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;