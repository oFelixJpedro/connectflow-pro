-- Fase 1: Adicionar coluna commercial_analysis_enabled em profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS commercial_analysis_enabled BOOLEAN DEFAULT false;

-- Comentário explicativo
COMMENT ON COLUMN public.profiles.commercial_analysis_enabled IS 'Quando true, este usuário será incluído nas análises do Gerente Comercial. Se false, é completamente ignorado (zero custo de IA).';

-- Fase 2: Criar tabela para snapshots diários incrementais
CREATE TABLE IF NOT EXISTS public.commercial_daily_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  
  -- Métricas agregadas incrementais
  total_conversations INTEGER DEFAULT 0,
  total_messages INTEGER DEFAULT 0,
  hot_leads INTEGER DEFAULT 0,
  warm_leads INTEGER DEFAULT 0,
  cold_leads INTEGER DEFAULT 0,
  closed_won INTEGER DEFAULT 0,
  closed_lost INTEGER DEFAULT 0,
  
  -- Scores médios acumulados
  avg_overall_score NUMERIC DEFAULT 0,
  avg_communication_score NUMERIC DEFAULT 0,
  avg_objectivity_score NUMERIC DEFAULT 0,
  avg_humanization_score NUMERIC DEFAULT 0,
  avg_objection_handling_score NUMERIC DEFAULT 0,
  avg_closing_score NUMERIC DEFAULT 0,
  avg_response_time_score NUMERIC DEFAULT 0,
  
  -- Contadores para cálculo de médias incrementais
  evaluated_conversations INTEGER DEFAULT 0,
  
  -- Insights gerados (última atualização)
  aggregated_insights JSONB DEFAULT '{}'::jsonb,
  
  -- Dados por atendente (somente habilitados)
  agents_data JSONB DEFAULT '[]'::jsonb,
  
  -- Objeções e pain points agregados
  top_objections JSONB DEFAULT '[]'::jsonb,
  top_pain_points JSONB DEFAULT '[]'::jsonb,
  
  -- Distribuição geográfica
  contacts_by_state JSONB DEFAULT '{}'::jsonb,
  deals_by_state JSONB DEFAULT '{}'::jsonb,
  
  -- Metadados de processamento
  messages_analyzed_count INTEGER DEFAULT 0,
  conversations_processed_count INTEGER DEFAULT 0,
  processing_started_at TIMESTAMPTZ,
  processing_completed_at TIMESTAMPTZ,
  processing_error TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(company_id, snapshot_date)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_commercial_daily_snapshots_company_date 
ON public.commercial_daily_snapshots(company_id, snapshot_date DESC);

-- RLS Policies
ALTER TABLE public.commercial_daily_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view snapshots in their company" 
ON public.commercial_daily_snapshots 
FOR SELECT 
USING ((company_id = get_user_company_id()) AND is_admin_or_owner());

CREATE POLICY "System can manage snapshots" 
ON public.commercial_daily_snapshots 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Fase 3: Criar tabela para conversas já processadas (evitar reprocessamento)
CREATE TABLE IF NOT EXISTS public.commercial_processed_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  
  -- Tracking de mensagens processadas
  last_message_count INTEGER DEFAULT 0,
  last_processed_at TIMESTAMPTZ DEFAULT now(),
  
  -- Dados da última avaliação (para incrementar)
  evaluation_data JSONB DEFAULT '{}'::jsonb,
  
  -- Dados da última análise de métricas
  metrics_data JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(conversation_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_commercial_processed_convs_company 
ON public.commercial_processed_conversations(company_id);

CREATE INDEX IF NOT EXISTS idx_commercial_processed_convs_conversation 
ON public.commercial_processed_conversations(conversation_id);

-- RLS Policies
ALTER TABLE public.commercial_processed_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System can manage processed conversations" 
ON public.commercial_processed_conversations 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Trigger para updated_at
CREATE TRIGGER update_commercial_daily_snapshots_updated_at
BEFORE UPDATE ON public.commercial_daily_snapshots
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_commercial_processed_conversations_updated_at
BEFORE UPDATE ON public.commercial_processed_conversations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();