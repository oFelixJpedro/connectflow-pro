-- =============================================
-- FOLLOW-UP SYSTEM TABLES
-- =============================================

-- 1. Follow-up Sequences (Main Configuration)
CREATE TABLE public.follow_up_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  
  -- Type of follow-up
  follow_up_type TEXT NOT NULL CHECK (follow_up_type IN ('manual', 'ai', 'advanced')),
  
  -- AI Configuration (for 'ai' and 'advanced' types)
  ai_model_type TEXT DEFAULT 'standard' CHECK (ai_model_type IN ('standard', 'advanced')),
  
  -- Advanced type exclusive settings
  persona_prompt TEXT,
  rules_content TEXT,
  knowledge_base_content TEXT,
  
  -- Application filters
  connection_ids UUID[] DEFAULT '{}',
  crm_stage_ids UUID[] DEFAULT '{}',
  tag_filters TEXT[] DEFAULT '{}',
  
  -- Operating hours
  operating_hours_enabled BOOLEAN DEFAULT false,
  operating_start_time TIME DEFAULT '09:00',
  operating_end_time TIME DEFAULT '18:00',
  operating_days INTEGER[] DEFAULT '{1,2,3,4,5}',
  
  -- Control
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'inactive')),
  priority INTEGER DEFAULT 0,
  
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Follow-up Sequence Steps
CREATE TABLE public.follow_up_sequence_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES follow_up_sequences(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  
  -- Time interval (relative to last message)
  delay_value INTEGER NOT NULL,
  delay_unit TEXT NOT NULL CHECK (delay_unit IN ('minutes', 'hours', 'days')),
  
  -- Content for 'manual' type
  manual_content TEXT,
  manual_media_url TEXT,
  manual_media_type TEXT,
  
  -- Instructions for 'ai' and 'advanced' types
  ai_instruction TEXT,
  
  -- Stop conditions
  stop_if_replied BOOLEAN DEFAULT true,
  stop_if_opened BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Follow-up Queue (Execution Queue)
CREATE TABLE public.follow_up_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  sequence_id UUID NOT NULL REFERENCES follow_up_sequences(id) ON DELETE CASCADE,
  current_step_id UUID REFERENCES follow_up_sequence_steps(id),
  
  -- Scheduling
  scheduled_at TIMESTAMPTZ NOT NULL,
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'processing', 'sent', 'failed', 'cancelled', 'stopped_reply', 'stopped_manual'
  )),
  
  -- Results
  sent_at TIMESTAMPTZ,
  sent_content TEXT,
  sent_media_url TEXT,
  failure_reason TEXT,
  failure_code TEXT,
  
  -- Tracking
  tokens_used INTEGER DEFAULT 0,
  processing_time_ms INTEGER,
  
  -- Reference to last message
  reference_message_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Follow-up Contact State
CREATE TABLE public.follow_up_contact_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE UNIQUE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Current sequence
  active_sequence_id UUID REFERENCES follow_up_sequences(id) ON DELETE SET NULL,
  current_step_order INTEGER DEFAULT 0,
  
  -- Control
  last_followup_sent_at TIMESTAMPTZ,
  last_contact_reply_at TIMESTAMPTZ,
  total_followups_sent INTEGER DEFAULT 0,
  
  -- Opt-out
  opted_out BOOLEAN DEFAULT false,
  opted_out_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Follow-up Knowledge Documents (for Advanced type)
CREATE TABLE public.follow_up_knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES follow_up_sequences(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  extracted_text TEXT,
  status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'error')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Follow-up Knowledge Chunks (for RAG)
CREATE TABLE public.follow_up_knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES follow_up_knowledge_documents(id) ON DELETE CASCADE,
  sequence_id UUID NOT NULL REFERENCES follow_up_sequences(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding vector(768),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

CREATE INDEX idx_followup_sequences_company ON follow_up_sequences(company_id, status);
CREATE INDEX idx_followup_steps_sequence ON follow_up_sequence_steps(sequence_id, step_order);
CREATE INDEX idx_followup_queue_scheduled ON follow_up_queue(scheduled_at, status);
CREATE INDEX idx_followup_queue_contact ON follow_up_queue(contact_id, status);
CREATE INDEX idx_followup_queue_company ON follow_up_queue(company_id, status);
CREATE INDEX idx_followup_queue_company_created ON follow_up_queue(company_id, created_at);
CREATE INDEX idx_followup_contact_state_company ON follow_up_contact_state(company_id);
CREATE INDEX idx_followup_knowledge_docs_sequence ON follow_up_knowledge_documents(sequence_id);
CREATE INDEX idx_followup_knowledge_chunks_sequence ON follow_up_knowledge_chunks(sequence_id);

-- =============================================
-- RLS POLICIES
-- =============================================

ALTER TABLE follow_up_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_up_sequence_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_up_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_up_contact_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_up_knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_up_knowledge_chunks ENABLE ROW LEVEL SECURITY;

-- Follow-up Sequences policies
CREATE POLICY "Users can view their company follow-up sequences"
  ON follow_up_sequences FOR SELECT
  USING (company_id = get_user_company_id());

CREATE POLICY "Admins can manage follow-up sequences"
  ON follow_up_sequences FOR ALL
  USING (company_id = get_user_company_id() AND is_admin_or_owner());

-- Follow-up Steps policies
CREATE POLICY "Users can view steps of their company sequences"
  ON follow_up_sequence_steps FOR SELECT
  USING (
    sequence_id IN (
      SELECT id FROM follow_up_sequences 
      WHERE company_id = get_user_company_id()
    )
  );

CREATE POLICY "Admins can manage sequence steps"
  ON follow_up_sequence_steps FOR ALL
  USING (
    sequence_id IN (
      SELECT id FROM follow_up_sequences 
      WHERE company_id = get_user_company_id()
    ) AND is_admin_or_owner()
  );

-- Follow-up Queue policies
CREATE POLICY "Users can view their company queue"
  ON follow_up_queue FOR SELECT
  USING (company_id = get_user_company_id());

CREATE POLICY "Admins can manage queue"
  ON follow_up_queue FOR ALL
  USING (company_id = get_user_company_id() AND is_admin_or_owner());

-- Follow-up Contact State policies
CREATE POLICY "Users can view their company contact states"
  ON follow_up_contact_state FOR SELECT
  USING (company_id = get_user_company_id());

CREATE POLICY "Admins can manage contact states"
  ON follow_up_contact_state FOR ALL
  USING (company_id = get_user_company_id() AND is_admin_or_owner());

-- Follow-up Knowledge Documents policies
CREATE POLICY "Users can view their company knowledge docs"
  ON follow_up_knowledge_documents FOR SELECT
  USING (company_id = get_user_company_id());

CREATE POLICY "Admins can manage knowledge docs"
  ON follow_up_knowledge_documents FOR ALL
  USING (company_id = get_user_company_id() AND is_admin_or_owner());

-- Follow-up Knowledge Chunks policies
CREATE POLICY "Users can view chunks of their company docs"
  ON follow_up_knowledge_chunks FOR SELECT
  USING (
    sequence_id IN (
      SELECT id FROM follow_up_sequences 
      WHERE company_id = get_user_company_id()
    )
  );

CREATE POLICY "Admins can manage knowledge chunks"
  ON follow_up_knowledge_chunks FOR ALL
  USING (
    sequence_id IN (
      SELECT id FROM follow_up_sequences 
      WHERE company_id = get_user_company_id()
    ) AND is_admin_or_owner()
  );

-- =============================================
-- UPDATE TRIGGERS
-- =============================================

CREATE TRIGGER update_follow_up_sequences_updated_at
  BEFORE UPDATE ON follow_up_sequences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_follow_up_queue_updated_at
  BEFORE UPDATE ON follow_up_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_follow_up_contact_state_updated_at
  BEFORE UPDATE ON follow_up_contact_state
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();