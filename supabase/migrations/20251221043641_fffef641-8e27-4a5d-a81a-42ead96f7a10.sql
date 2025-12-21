-- Criar tabela de logs de contatos
CREATE TABLE public.contact_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  
  -- Referência ao contato (sem FK para persistir após exclusão)
  contact_id UUID,
  
  -- Snapshot do contato no momento do evento
  contact_snapshot JSONB NOT NULL DEFAULT '{}',
  
  -- Detalhes do evento
  event_type VARCHAR(50) NOT NULL,
  event_data JSONB DEFAULT '{}',
  
  -- Quem executou
  performed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  performed_by_name VARCHAR(255),
  is_automatic BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_contact_logs_company ON public.contact_logs(company_id);
CREATE INDEX idx_contact_logs_contact ON public.contact_logs(contact_id);
CREATE INDEX idx_contact_logs_created ON public.contact_logs(created_at DESC);
CREATE INDEX idx_contact_logs_event_type ON public.contact_logs(event_type);

-- Enable RLS
ALTER TABLE public.contact_logs ENABLE ROW LEVEL SECURITY;

-- Usuários podem ver logs da sua empresa
CREATE POLICY "Users can view contact logs in their company"
  ON public.contact_logs
  FOR SELECT
  USING (company_id = get_user_company_id());

-- Usuários podem inserir logs
CREATE POLICY "Users can insert contact logs"
  ON public.contact_logs
  FOR INSERT
  WITH CHECK (company_id = get_user_company_id());

-- System pode inserir logs (para ações automáticas)
CREATE POLICY "System can insert contact logs"
  ON public.contact_logs
  FOR INSERT
  WITH CHECK (true);