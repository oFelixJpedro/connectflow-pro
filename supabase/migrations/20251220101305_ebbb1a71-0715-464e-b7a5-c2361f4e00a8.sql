-- ═══════════════════════════════════════════════════════════════════
-- COMMERCIAL PIXEL: Tabelas para análise em tempo real de conversas
-- ═══════════════════════════════════════════════════════════════════

-- 1. Tabela de eventos granulares de conversa (log de tudo)
CREATE TABLE public.conversation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  event_type varchar NOT NULL, -- 'message', 'deal_signal', 'objection', 'closing_signal', 'disqualification', 'contract_closed'
  event_data jsonb DEFAULT '{}',
  ai_insights jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- 2. Tabela de métricas em tempo real por conversa
CREATE TABLE public.conversation_live_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid UNIQUE NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  
  -- Contadores
  total_messages int DEFAULT 0,
  agent_messages int DEFAULT 0,
  client_messages int DEFAULT 0,
  avg_response_time_seconds int DEFAULT 0,
  
  -- Análise de sentimento e interesse
  current_sentiment varchar DEFAULT 'neutral', -- positive, negative, neutral
  interest_level int DEFAULT 3, -- 1-5
  engagement_score numeric(4,2) DEFAULT 5.0,
  
  -- Sinais detectados pela IA
  deal_signals text[] DEFAULT '{}',
  objections_detected text[] DEFAULT '{}',
  pain_points text[] DEFAULT '{}',
  
  -- Status do lead (atualizado em tempo real)
  lead_status varchar DEFAULT 'unknown', -- cold, warming, hot, closed_won, closed_lost
  lead_status_confidence numeric(4,2) DEFAULT 0.5,
  
  -- Previsões
  close_probability numeric(5,2) DEFAULT 0.0, -- 0-100%
  predicted_outcome varchar, -- likely_close, likely_lost, needs_followup
  
  -- Timestamps
  last_activity_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Tabela de dashboard agregado por empresa (métricas em tempo real)
CREATE TABLE public.company_live_dashboard (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid UNIQUE NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  
  -- Contadores de leads ativos
  active_conversations int DEFAULT 0,
  hot_leads int DEFAULT 0,
  warm_leads int DEFAULT 0,
  cold_leads int DEFAULT 0,
  
  -- Métricas do dia
  today_messages int DEFAULT 0,
  today_new_conversations int DEFAULT 0,
  today_contracts_closed int DEFAULT 0,
  today_leads_lost int DEFAULT 0,
  
  -- Aggregações
  top_objections jsonb DEFAULT '[]',
  top_pain_points jsonb DEFAULT '[]',
  current_avg_response_time int DEFAULT 0,
  current_avg_sentiment varchar DEFAULT 'neutral',
  
  -- Timestamps
  last_reset_date date DEFAULT CURRENT_DATE,
  updated_at timestamptz DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════
-- Indexes para performance
-- ═══════════════════════════════════════════════════════════════════
CREATE INDEX idx_conversation_events_conv ON public.conversation_events(conversation_id);
CREATE INDEX idx_conversation_events_company ON public.conversation_events(company_id);
CREATE INDEX idx_conversation_events_type ON public.conversation_events(event_type);
CREATE INDEX idx_conversation_events_created ON public.conversation_events(created_at DESC);

CREATE INDEX idx_conversation_live_metrics_company ON public.conversation_live_metrics(company_id);
CREATE INDEX idx_conversation_live_metrics_status ON public.conversation_live_metrics(lead_status);
CREATE INDEX idx_conversation_live_metrics_activity ON public.conversation_live_metrics(last_activity_at DESC);

-- ═══════════════════════════════════════════════════════════════════
-- Enable RLS
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE public.conversation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_live_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_live_dashboard ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════════
-- RLS Policies - conversation_events
-- ═══════════════════════════════════════════════════════════════════
CREATE POLICY "Users can view events in their company"
ON public.conversation_events FOR SELECT
USING (company_id = get_user_company_id());

CREATE POLICY "System can insert events"
ON public.conversation_events FOR INSERT
WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════
-- RLS Policies - conversation_live_metrics
-- ═══════════════════════════════════════════════════════════════════
CREATE POLICY "Users can view live metrics in their company"
ON public.conversation_live_metrics FOR SELECT
USING (company_id = get_user_company_id());

CREATE POLICY "System can manage live metrics"
ON public.conversation_live_metrics FOR ALL
USING (true)
WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════
-- RLS Policies - company_live_dashboard
-- ═══════════════════════════════════════════════════════════════════
CREATE POLICY "Admins can view company dashboard"
ON public.company_live_dashboard FOR SELECT
USING (company_id = get_user_company_id() AND is_admin_or_owner());

CREATE POLICY "System can manage company dashboard"
ON public.company_live_dashboard FOR ALL
USING (true)
WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════
-- Enable Realtime for live updates
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE public.conversation_live_metrics REPLICA IDENTITY FULL;
ALTER TABLE public.company_live_dashboard REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_live_metrics;
ALTER PUBLICATION supabase_realtime ADD TABLE public.company_live_dashboard;

-- ═══════════════════════════════════════════════════════════════════
-- Trigger to detect contract closure from Kanban
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.on_kanban_card_column_change()
RETURNS TRIGGER AS $$
DECLARE
  column_name text;
  board_company_id uuid;
  contact_conversation_id uuid;
BEGIN
  -- Only process if column changed
  IF OLD.column_id = NEW.column_id THEN
    RETURN NEW;
  END IF;
  
  -- Get new column name and company
  SELECT kc.name, kb.company_id INTO column_name, board_company_id
  FROM public.kanban_columns kc
  JOIN public.kanban_boards kb ON kb.id = kc.board_id
  WHERE kc.id = NEW.column_id;
  
  -- Get conversation for this contact
  SELECT c.id INTO contact_conversation_id
  FROM public.conversations c
  WHERE c.contact_id = NEW.contact_id
  ORDER BY c.last_message_at DESC
  LIMIT 1;
  
  -- Check if moved to "Fechado" or similar
  IF lower(column_name) IN ('fechado', 'ganho', 'contrato fechado', 'won', 'closed won') THEN
    -- Update live metrics
    UPDATE public.conversation_live_metrics
    SET lead_status = 'closed_won',
        lead_status_confidence = 1.0,
        close_probability = 100.0,
        updated_at = now()
    WHERE conversation_id = contact_conversation_id;
    
    -- Update company dashboard
    UPDATE public.company_live_dashboard
    SET today_contracts_closed = today_contracts_closed + 1,
        hot_leads = GREATEST(0, hot_leads - 1),
        updated_at = now()
    WHERE company_id = board_company_id;
    
  -- Check if moved to "Perdido" or similar  
  ELSIF lower(column_name) IN ('perdido', 'desqualificado', 'lost', 'closed lost') THEN
    UPDATE public.conversation_live_metrics
    SET lead_status = 'closed_lost',
        lead_status_confidence = 1.0,
        close_probability = 0.0,
        updated_at = now()
    WHERE conversation_id = contact_conversation_id;
    
    UPDATE public.company_live_dashboard
    SET today_leads_lost = today_leads_lost + 1,
        updated_at = now()
    WHERE company_id = board_company_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on kanban_cards
CREATE TRIGGER on_kanban_card_column_change_trigger
  AFTER UPDATE ON public.kanban_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.on_kanban_card_column_change();

-- ═══════════════════════════════════════════════════════════════════
-- Function to reset daily counters
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.reset_daily_dashboard_counters()
RETURNS void AS $$
BEGIN
  UPDATE public.company_live_dashboard
  SET 
    today_messages = 0,
    today_new_conversations = 0,
    today_contracts_closed = 0,
    today_leads_lost = 0,
    last_reset_date = CURRENT_DATE,
    updated_at = now()
  WHERE last_reset_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;