-- ═══════════════════════════════════════════════════════════════════
-- PERFORMANCE INDEXES FOR PHASE 1 OPTIMIZATION
-- ═══════════════════════════════════════════════════════════════════

-- 1. INDEX COMPOSTO PARA LISTAGEM DE CONVERSAS NO INBOX
-- Usado em: loadConversations query (whatsapp_connection_id + order by last_message_at)
CREATE INDEX IF NOT EXISTS idx_conversations_inbox_list 
ON public.conversations (whatsapp_connection_id, last_message_at DESC NULLS LAST)
WHERE status != 'closed';

-- 2. INDEX PARA CONVERSAS POR USUÁRIO ATRIBUÍDO
-- Usado em: filtro "Minhas conversas" (assigned_user_id)
CREATE INDEX IF NOT EXISTS idx_conversations_assigned_user 
ON public.conversations (assigned_user_id, last_message_at DESC NULLS LAST)
WHERE assigned_user_id IS NOT NULL;

-- 3. INDEX PARA CONVERSAS NÃO ATRIBUÍDAS (FILA)
-- Usado em: filtro "Fila" (assigned_user_id IS NULL)
CREATE INDEX IF NOT EXISTS idx_conversations_queue 
ON public.conversations (whatsapp_connection_id, last_message_at DESC NULLS LAST)
WHERE assigned_user_id IS NULL AND status != 'closed';

-- 4. INDEX PARA MENSAGENS DE UMA CONVERSA
-- Usado em: loadMessages query (conversation_id + order by created_at)
CREATE INDEX IF NOT EXISTS idx_messages_conversation 
ON public.messages (conversation_id, created_at ASC);

-- 5. INDEX PARA CONVERSAS COM UNREAD
-- Usado em: notificações e contagem de não lidas
CREATE INDEX IF NOT EXISTS idx_conversations_unread 
ON public.conversations (company_id, whatsapp_connection_id)
WHERE unread_count > 0;

-- 6. INDEX PARA BUSCA DE CONEXÃO POR SESSION_ID
-- Usado em: webhook para encontrar conexão (session_id)
CREATE INDEX IF NOT EXISTS idx_connections_session 
ON public.whatsapp_connections (session_id);

-- 7. INDEX PARA MENSAGENS POR WHATSAPP_MESSAGE_ID
-- Usado em: webhook para detectar duplicatas e buscar citações
CREATE INDEX IF NOT EXISTS idx_messages_whatsapp_id 
ON public.messages (whatsapp_message_id)
WHERE whatsapp_message_id IS NOT NULL;

-- 8. INDEX PARA CONTATOS POR COMPANY + PHONE
-- Usado em: webhook para buscar/criar contatos
CREATE INDEX IF NOT EXISTS idx_contacts_company_phone 
ON public.contacts (company_id, phone_number);

-- 9. INDEX PARA DEPARTAMENTO PADRÃO
-- Usado em: webhook para buscar departamento padrão
CREATE INDEX IF NOT EXISTS idx_departments_default 
ON public.departments (whatsapp_connection_id)
WHERE is_default = true;

-- 10. INDEX PARA REAÇÕES DE MENSAGEM
-- Usado em: carregar reações ao carregar mensagens
CREATE INDEX IF NOT EXISTS idx_reactions_message 
ON public.message_reactions (message_id);

-- 11. INDEX PARA CONNECTION_USERS (acesso de agentes)
-- Usado em: verificar permissões de acesso
CREATE INDEX IF NOT EXISTS idx_connection_users_user 
ON public.connection_users (user_id, connection_id);

-- 12. INDEX PARA DEPARTMENT_USERS (acesso de departamentos)
-- Usado em: verificar permissões de departamento
CREATE INDEX IF NOT EXISTS idx_department_users_user 
ON public.department_users (user_id, department_id);

-- 13. INDEX PARA CONVERSATION_FOLLOWERS
-- Usado em: filtro "Seguindo"
CREATE INDEX IF NOT EXISTS idx_conversation_followers_user 
ON public.conversation_followers (user_id);

-- 14. INDEX PARA INTERNAL CHAT MESSAGES
-- Usado em: carregar mensagens do chat interno
CREATE INDEX IF NOT EXISTS idx_internal_chat_messages_room 
ON public.internal_chat_messages (room_id, created_at ASC);

-- 15. INDEX PARA PROFILES POR COMPANY
-- Usado em: listar membros do time
CREATE INDEX IF NOT EXISTS idx_profiles_company 
ON public.profiles (company_id)
WHERE active = true;