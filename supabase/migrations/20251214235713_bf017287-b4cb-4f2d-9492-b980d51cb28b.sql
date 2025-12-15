-- =============================================
-- CORREÇÕES DE SEGURANÇA CRÍTICAS
-- =============================================

-- 1. BLOQUEAR ACESSO DIRETO À TABELA developer_auth
-- Esta tabela contém credenciais sensíveis e só deve ser acessada via Edge Functions com service_role
CREATE POLICY "Block all direct access to developer_auth"
ON public.developer_auth
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

-- 2. BLOQUEAR ACESSO DIRETO À TABELA developer_audit_logs
-- Esta tabela contém logs sensíveis de auditoria e só deve ser acessada via Edge Functions com service_role
CREATE POLICY "Block all direct access to developer_audit_logs"
ON public.developer_audit_logs
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

-- 3. CORRIGIR POLÍTICA INSERT PERMISSIVA DE kanban_cards
-- A política atual usa WITH CHECK (true) que é muito permissiva
DROP POLICY IF EXISTS "Users can create cards" ON public.kanban_cards;

CREATE POLICY "Users can create cards with validation"
ON public.kanban_cards
FOR INSERT
TO authenticated
WITH CHECK (
  can_user_access_column(column_id) AND has_crm_access()
);

-- 4. CORRIGIR FUNÇÃO update_updated_at_column COM search_path FIXO
-- Previne ataques de "search path hijacking"
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- 5. ADICIONAR POLÍTICA UPDATE FALTANTE PARA connection_users
CREATE POLICY "Admins can update connection_users"
ON public.connection_users
FOR UPDATE
TO authenticated
USING (
  get_connection_company_id(connection_id) = get_user_company_id() 
  AND is_admin_or_owner()
)
WITH CHECK (
  get_connection_company_id(connection_id) = get_user_company_id() 
  AND is_admin_or_owner()
);