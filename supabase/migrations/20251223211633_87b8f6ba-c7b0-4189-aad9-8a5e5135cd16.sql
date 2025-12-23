-- ==================== FASE 1.1: CRIAR ÍNDICES FALTANTES ====================
-- Índices para otimizar queries frequentes que estão fazendo sequential scans

-- profiles é a tabela mais escaneada (11.7M seq scans!)
CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_profiles_active_company ON profiles(company_id, active);

-- user_roles verificado em quase todas as operações RLS
CREATE INDEX IF NOT EXISTS idx_user_roles_user_role ON user_roles(user_id, role);

-- internal_chat_rooms consulta frequente
CREATE INDEX IF NOT EXISTS idx_internal_chat_rooms_company ON internal_chat_rooms(company_id);

-- whatsapp_connections
CREATE INDEX IF NOT EXISTS idx_whatsapp_connections_company_status ON whatsapp_connections(company_id, status);

-- conversations (queries frequentes)
CREATE INDEX IF NOT EXISTS idx_conversations_company_status ON conversations(company_id, status);
CREATE INDEX IF NOT EXISTS idx_conversations_assigned ON conversations(assigned_user_id, status) WHERE assigned_user_id IS NOT NULL;

-- messages (muitas queries por conversation_id)
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at DESC);

-- connection_users (join frequente)
CREATE INDEX IF NOT EXISTS idx_connection_users_user ON connection_users(user_id);
CREATE INDEX IF NOT EXISTS idx_connection_users_connection ON connection_users(connection_id);

-- department_users (join frequente)
CREATE INDEX IF NOT EXISTS idx_department_users_user ON department_users(user_id);
CREATE INDEX IF NOT EXISTS idx_department_users_dept ON department_users(department_id);

-- ==================== FASE 1.3: OTIMIZAR FUNÇÕES RLS COM SESSION CACHE ====================

-- Versão otimizada de get_user_company_id() com cache de sessão
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    cached_company_id uuid;
    current_user_id uuid;
BEGIN
    current_user_id := auth.uid();
    
    IF current_user_id IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Try to get from session cache
    BEGIN
        cached_company_id := current_setting('app.company_id', true)::uuid;
        IF cached_company_id IS NOT NULL THEN
            RETURN cached_company_id;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- Setting doesn't exist, continue to query
    END;
    
    -- Query and cache
    SELECT company_id INTO cached_company_id
    FROM profiles 
    WHERE id = current_user_id;
    
    -- Store in session cache
    IF cached_company_id IS NOT NULL THEN
        PERFORM set_config('app.company_id', cached_company_id::text, true);
    END IF;
    
    RETURN cached_company_id;
END;
$$;

-- Versão otimizada de get_user_role() com cache de sessão  
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS app_role
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    cached_role app_role;
    current_user_id uuid;
BEGIN
    current_user_id := auth.uid();
    
    IF current_user_id IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Try to get from session cache
    BEGIN
        cached_role := current_setting('app.user_role', true)::app_role;
        IF cached_role IS NOT NULL THEN
            RETURN cached_role;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- Setting doesn't exist, continue to query
    END;
    
    -- Query and cache
    SELECT role INTO cached_role
    FROM user_roles 
    WHERE user_id = current_user_id
    LIMIT 1;
    
    -- Store in session cache
    IF cached_role IS NOT NULL THEN
        PERFORM set_config('app.user_role', cached_role::text, true);
    END IF;
    
    RETURN cached_role;
END;
$$;

-- Versão otimizada de is_admin_or_owner() usando cache
CREATE OR REPLACE FUNCTION public.is_admin_or_owner()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_role app_role;
BEGIN
    user_role := get_user_role();
    RETURN user_role IN ('owner', 'admin');
END;
$$;

-- ==================== FASE 4.1: FUNÇÃO PARA LIMPEZA DE DADOS ====================

-- Função para limpar conversation_events antigos (manter últimos 30 dias)
CREATE OR REPLACE FUNCTION public.cleanup_old_conversation_events()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete events older than 30 days, keep only closing_signal and disqualification
    DELETE FROM public.conversation_events
    WHERE created_at < NOW() - INTERVAL '30 days'
    AND event_type NOT IN ('closing_signal', 'disqualification');
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

-- Função para vacuum e analyze das tabelas principais
CREATE OR REPLACE FUNCTION public.optimize_tables()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Analyze principais tabelas para atualizar estatísticas
    ANALYZE profiles;
    ANALYZE user_roles;
    ANALYZE conversations;
    ANALYZE messages;
    ANALYZE conversation_events;
    ANALYZE connection_users;
    ANALYZE department_users;
END;
$$;

-- ==================== FASE 5.1: ADICIONAR CAMPO DE CACHE DE SUBSCRIPTION ====================

-- Adicionar campo para cache de subscription na tabela companies
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS subscription_cache jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS subscription_cache_updated_at timestamp with time zone;