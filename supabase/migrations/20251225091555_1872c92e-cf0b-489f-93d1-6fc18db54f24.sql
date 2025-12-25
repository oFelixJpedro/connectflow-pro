-- Tabela para rastrear sessões ativas dos usuários
CREATE TABLE public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  session_token text NOT NULL UNIQUE,
  device_info jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  last_active_at timestamptz DEFAULT now(),
  invalidated_at timestamptz,
  invalidated_reason text
);

-- Índices para performance
CREATE INDEX idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX idx_user_sessions_active ON public.user_sessions(user_id, is_active) WHERE is_active = true;
CREATE INDEX idx_user_sessions_token ON public.user_sessions(session_token);
CREATE INDEX idx_user_sessions_company ON public.user_sessions(company_id);

-- RLS Policies
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Usuários podem ver suas próprias sessões
CREATE POLICY "Users can view own sessions"
  ON public.user_sessions
  FOR SELECT
  USING (user_id = auth.uid());

-- Sistema pode gerenciar todas as sessões (via service_role)
CREATE POLICY "System can manage all sessions"
  ON public.user_sessions
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Função para limpar sessões antigas (inativas há mais de 24 horas)
CREATE OR REPLACE FUNCTION public.cleanup_old_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM user_sessions
  WHERE is_active = false 
    AND invalidated_at < NOW() - INTERVAL '24 hours';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Habilitar Realtime para a tabela
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_sessions;