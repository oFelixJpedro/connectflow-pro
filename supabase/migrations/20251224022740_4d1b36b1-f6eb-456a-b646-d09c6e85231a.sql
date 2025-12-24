-- ═══════════════════════════════════════════════════════════════════
-- SUPORTE A GRUPOS DE WHATSAPP COM CONTROLE DE CUSTOS
-- ═══════════════════════════════════════════════════════════════════

-- 1. Adicionar coluna is_group na tabela conversations
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS is_group BOOLEAN DEFAULT FALSE;

-- 2. Criar índice para consultas de grupo
CREATE INDEX IF NOT EXISTS idx_conversations_is_group 
ON public.conversations (is_group) 
WHERE is_group = true;

-- 3. Índice composto para filtrar conversas normais (não grupo)
CREATE INDEX IF NOT EXISTS idx_conversations_company_not_group 
ON public.conversations (company_id, is_group) 
WHERE is_group = false;

-- 4. Comentário para documentação
COMMENT ON COLUMN public.conversations.is_group IS 'Indica se a conversa é de um grupo de WhatsApp. Grupos têm funcionalidades de IA limitadas para controle de custos.';