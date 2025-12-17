-- =====================================================
-- SISTEMA DE AGENTES DE IA - ESTRUTURA COMPLETA
-- =====================================================

-- 1. Tabela principal: ai_agents
CREATE TABLE public.ai_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  agent_type VARCHAR(20) NOT NULL CHECK (agent_type IN ('single', 'multi')),
  is_primary BOOLEAN DEFAULT false,
  parent_agent_id UUID REFERENCES public.ai_agents(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'inactive' CHECK (status IN ('active', 'paused', 'inactive')),
  paused_until TIMESTAMPTZ,
  
  -- Configurações básicas
  delay_seconds INTEGER DEFAULT 20,
  
  -- Conteúdo do agente (system prompt em 3 partes - máx 15000 chars total)
  rules_content TEXT,
  script_content TEXT,
  faq_content TEXT,
  
  -- Informações da empresa para FAQ
  company_info JSONB DEFAULT '{}',
  contract_link TEXT,
  
  -- Configurações de ativação
  activation_triggers TEXT[] DEFAULT '{}',
  require_activation_trigger BOOLEAN DEFAULT false,
  deactivate_on_human_message VARCHAR(20) DEFAULT 'never' CHECK (deactivate_on_human_message IN ('never', 'always', 'temporary')),
  deactivate_temporary_minutes INTEGER DEFAULT 5,
  
  -- Configurações de áudio
  audio_enabled BOOLEAN DEFAULT false,
  audio_respond_with_audio BOOLEAN DEFAULT false,
  audio_always_respond_audio BOOLEAN DEFAULT false,
  voice_name VARCHAR(50) DEFAULT 'Kore',
  speech_speed DECIMAL(2,1) DEFAULT 1.0 CHECK (speech_speed >= 0.5 AND speech_speed <= 2.0),
  
  -- Metadados
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id)
);

-- Índices para ai_agents
CREATE INDEX idx_ai_agents_company ON public.ai_agents(company_id);
CREATE INDEX idx_ai_agents_status ON public.ai_agents(status);
CREATE INDEX idx_ai_agents_parent ON public.ai_agents(parent_agent_id);
CREATE INDEX idx_ai_agents_type ON public.ai_agents(agent_type);

-- 2. Tabela: ai_agent_connections (Conexões vinculadas ao agente)
CREATE TABLE public.ai_agent_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES public.whatsapp_connections(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, connection_id)
);

CREATE INDEX idx_ai_agent_connections_agent ON public.ai_agent_connections(agent_id);
CREATE INDEX idx_ai_agent_connections_connection ON public.ai_agent_connections(connection_id);

-- 3. Tabela: ai_agent_media (Mídias do agente para envio via {{}})
CREATE TABLE public.ai_agent_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  media_type VARCHAR(20) NOT NULL CHECK (media_type IN ('image', 'video', 'audio', 'document', 'text', 'link')),
  media_key VARCHAR(100) NOT NULL,
  media_url TEXT,
  media_content TEXT,
  file_name VARCHAR(255),
  file_size INTEGER,
  mime_type VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, media_key)
);

CREATE INDEX idx_ai_agent_media_agent ON public.ai_agent_media(agent_id);
CREATE INDEX idx_ai_agent_media_key ON public.ai_agent_media(media_key);

-- 4. Tabela: ai_conversation_states (Estado da IA por conversa)
CREATE TABLE public.ai_conversation_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE UNIQUE,
  agent_id UUID REFERENCES public.ai_agents(id) ON DELETE SET NULL,
  status VARCHAR(30) DEFAULT 'inactive' CHECK (status IN ('active', 'paused', 'inactive', 'deactivated_permanently')),
  paused_until TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  deactivated_at TIMESTAMPTZ,
  deactivation_reason VARCHAR(50),
  current_sub_agent_id UUID REFERENCES public.ai_agents(id) ON DELETE SET NULL,
  messages_processed INTEGER DEFAULT 0,
  last_response_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_conversation_states_conversation ON public.ai_conversation_states(conversation_id);
CREATE INDEX idx_ai_conversation_states_agent ON public.ai_conversation_states(agent_id);
CREATE INDEX idx_ai_conversation_states_status ON public.ai_conversation_states(status);

-- 5. Tabela: ai_agent_templates (Modelos de agentes - Developer)
CREATE TABLE public.ai_agent_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  agent_type VARCHAR(20) NOT NULL CHECK (agent_type IN ('single', 'multi')),
  
  -- Conteúdo template
  rules_template TEXT,
  script_template TEXT,
  faq_template TEXT,
  company_info_template JSONB DEFAULT '{}',
  
  -- Configurações padrão
  default_delay_seconds INTEGER DEFAULT 20,
  default_voice_name VARCHAR(50) DEFAULT 'Kore',
  default_speech_speed DECIMAL(2,1) DEFAULT 1.0,
  
  -- Controle
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by VARCHAR(255)
);

CREATE INDEX idx_ai_agent_templates_category ON public.ai_agent_templates(category);
CREATE INDEX idx_ai_agent_templates_active ON public.ai_agent_templates(is_active);

-- 6. Tabela: ai_agent_logs (Logs de ações do agente)
CREATE TABLE public.ai_agent_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  action_type VARCHAR(50) NOT NULL,
  input_text TEXT,
  output_text TEXT,
  tokens_used INTEGER,
  processing_time_ms INTEGER,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_agent_logs_agent ON public.ai_agent_logs(agent_id);
CREATE INDEX idx_ai_agent_logs_conversation ON public.ai_agent_logs(conversation_id);
CREATE INDEX idx_ai_agent_logs_created ON public.ai_agent_logs(created_at DESC);
CREATE INDEX idx_ai_agent_logs_action ON public.ai_agent_logs(action_type);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- ai_agents: empresa só vê seus agentes
ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view agents in their company"
  ON public.ai_agents FOR SELECT
  USING (company_id = get_user_company_id());

CREATE POLICY "Admins can create agents"
  ON public.ai_agents FOR INSERT
  WITH CHECK (company_id = get_user_company_id() AND is_admin_or_owner());

CREATE POLICY "Admins can update agents"
  ON public.ai_agents FOR UPDATE
  USING (company_id = get_user_company_id() AND is_admin_or_owner());

CREATE POLICY "Admins can delete agents"
  ON public.ai_agents FOR DELETE
  USING (company_id = get_user_company_id() AND is_admin_or_owner());

-- ai_agent_connections
ALTER TABLE public.ai_agent_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view agent connections in their company"
  ON public.ai_agent_connections FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.ai_agents WHERE id = agent_id AND company_id = get_user_company_id()
  ));

CREATE POLICY "Admins can manage agent connections"
  ON public.ai_agent_connections FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.ai_agents WHERE id = agent_id AND company_id = get_user_company_id()
  ) AND is_admin_or_owner());

-- ai_agent_media
ALTER TABLE public.ai_agent_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view agent media in their company"
  ON public.ai_agent_media FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.ai_agents WHERE id = agent_id AND company_id = get_user_company_id()
  ));

CREATE POLICY "Admins can manage agent media"
  ON public.ai_agent_media FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.ai_agents WHERE id = agent_id AND company_id = get_user_company_id()
  ) AND is_admin_or_owner());

-- ai_conversation_states
ALTER TABLE public.ai_conversation_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view conversation states in their company"
  ON public.ai_conversation_states FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.conversations WHERE id = conversation_id AND company_id = get_user_company_id()
  ));

CREATE POLICY "Users can manage conversation states in their company"
  ON public.ai_conversation_states FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.conversations WHERE id = conversation_id AND company_id = get_user_company_id()
  ));

-- ai_agent_templates: público para leitura, bloqueado para escrita (via developer)
ALTER TABLE public.ai_agent_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Templates are readable by authenticated users"
  ON public.ai_agent_templates FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Block direct template modifications"
  ON public.ai_agent_templates FOR ALL
  USING (false)
  WITH CHECK (false);

-- ai_agent_logs
ALTER TABLE public.ai_agent_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view logs in their company"
  ON public.ai_agent_logs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.ai_agents WHERE id = agent_id AND company_id = get_user_company_id()
  ));

CREATE POLICY "System can insert logs"
  ON public.ai_agent_logs FOR INSERT
  WITH CHECK (true);

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Trigger para atualizar updated_at em ai_agents
CREATE TRIGGER update_ai_agents_updated_at
  BEFORE UPDATE ON public.ai_agents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para atualizar updated_at em ai_conversation_states
CREATE TRIGGER update_ai_conversation_states_updated_at
  BEFORE UPDATE ON public.ai_conversation_states
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para atualizar updated_at em ai_agent_templates
CREATE TRIGGER update_ai_agent_templates_updated_at
  BEFORE UPDATE ON public.ai_agent_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();