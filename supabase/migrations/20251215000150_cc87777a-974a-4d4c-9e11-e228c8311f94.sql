-- =============================================
-- CORREÇÕES DE SEGURANÇA DE MÉDIO RISCO
-- =============================================

-- 1. ADICIONAR POLÍTICA UPDATE PARA internal_chat_messages
-- Permite que usuários atualizem apenas suas próprias mensagens
CREATE POLICY "Users can update their own messages"
ON public.internal_chat_messages
FOR UPDATE
TO authenticated
USING (sender_id = auth.uid())
WITH CHECK (sender_id = auth.uid());

-- 2. ADICIONAR POLÍTICA DELETE PARA internal_chat_messages
-- Apenas admins podem deletar mensagens do chat interno
CREATE POLICY "Admins can delete internal chat messages"
ON public.internal_chat_messages
FOR DELETE
TO authenticated
USING (
  room_belongs_to_user_company(room_id) 
  AND is_admin_or_owner()
);

-- 3. ADICIONAR POLÍTICA DELETE PARA kanban_card_comments
-- Usuários podem deletar seus próprios comentários, admins podem deletar qualquer um
CREATE POLICY "Users can delete their own comments"
ON public.kanban_card_comments
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid() 
  OR (
    get_card_company_id(card_id) = get_user_company_id() 
    AND is_admin_or_owner()
  )
);

-- 4. ADICIONAR POLÍTICA UPDATE PARA kanban_card_comments
-- Usuários podem editar apenas seus próprios comentários
CREATE POLICY "Users can update their own comments"
ON public.kanban_card_comments
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid() 
  AND get_card_company_id(card_id) = get_user_company_id() 
  AND has_crm_access()
)
WITH CHECK (
  user_id = auth.uid() 
  AND get_card_company_id(card_id) = get_user_company_id() 
  AND has_crm_access()
);