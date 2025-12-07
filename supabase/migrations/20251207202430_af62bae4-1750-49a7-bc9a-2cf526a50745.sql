-- ============================================================
-- MIGRATION: Sistema de Atribuição de Conversas (Parte 1)
-- ============================================================

-- 1. ADICIONAR NOVAS COLUNAS (sem remover company_id ainda)
ALTER TABLE public.departments 
ADD COLUMN IF NOT EXISTS whatsapp_connection_id uuid REFERENCES public.whatsapp_connections(id) ON DELETE CASCADE;

ALTER TABLE public.departments 
ADD COLUMN IF NOT EXISTS is_default boolean DEFAULT false;

-- 2. MIGRAR DADOS EXISTENTES
-- Para cada department existente, associar à primeira conexão da empresa
UPDATE public.departments d
SET whatsapp_connection_id = (
  SELECT wc.id 
  FROM public.whatsapp_connections wc 
  WHERE wc.company_id = d.company_id 
  ORDER BY wc.created_at ASC 
  LIMIT 1
)
WHERE d.whatsapp_connection_id IS NULL;

-- 3. CRIAR DEPARTAMENTOS PADRÃO PARA CONEXÕES SEM DEPARTAMENTO
-- Precisamos pegar o company_id da conexão para o INSERT
INSERT INTO public.departments (name, company_id, whatsapp_connection_id, is_default, color, active)
SELECT 
  'Geral',
  wc.company_id,
  wc.id,
  true,
  '#3B82F6',
  true
FROM public.whatsapp_connections wc
WHERE NOT EXISTS (
  SELECT 1 FROM public.departments d WHERE d.whatsapp_connection_id = wc.id
);

-- 4. GARANTIR QUE PELO MENOS UM DEPARTMENT POR CONEXÃO TENHA is_default=true
UPDATE public.departments 
SET is_default = true
WHERE id IN (
  SELECT DISTINCT ON (whatsapp_connection_id) id
  FROM public.departments
  WHERE whatsapp_connection_id IS NOT NULL
  AND whatsapp_connection_id NOT IN (
    SELECT whatsapp_connection_id FROM public.departments WHERE is_default = true AND whatsapp_connection_id IS NOT NULL
  )
  ORDER BY whatsapp_connection_id, created_at ASC
);

-- 5. Deletar departments órfãos que não conseguiram ser migrados
DELETE FROM public.departments WHERE whatsapp_connection_id IS NULL;

-- 6. Tornar whatsapp_connection_id NOT NULL
ALTER TABLE public.departments 
ALTER COLUMN whatsapp_connection_id SET NOT NULL;

-- 7. DROPAR POLICIES antigas que referenciam company_id
DROP POLICY IF EXISTS "Admins can delete departments" ON public.departments;
DROP POLICY IF EXISTS "Admins can insert departments" ON public.departments;
DROP POLICY IF EXISTS "Admins can update departments" ON public.departments;
DROP POLICY IF EXISTS "Users can view departments in their company" ON public.departments;

-- 8. REMOVER CONSTRAINT E COLUNA company_id
ALTER TABLE public.departments DROP CONSTRAINT IF EXISTS departments_company_id_fkey;
ALTER TABLE public.departments DROP COLUMN IF EXISTS company_id;

-- 9. Helper function para verificar company_id da conexão
CREATE OR REPLACE FUNCTION public.get_connection_company_id(connection_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.whatsapp_connections WHERE id = connection_id
$$;

-- 10. CRIAR NOVAS POLICIES DE RLS PARA DEPARTMENTS
CREATE POLICY "Users can view departments of their company connections"
ON public.departments
FOR SELECT
USING (
  get_connection_company_id(whatsapp_connection_id) = get_user_company_id()
);

CREATE POLICY "Admins can insert departments"
ON public.departments
FOR INSERT
WITH CHECK (
  get_connection_company_id(whatsapp_connection_id) = get_user_company_id()
  AND is_admin_or_owner()
);

CREATE POLICY "Admins can update departments"
ON public.departments
FOR UPDATE
USING (
  get_connection_company_id(whatsapp_connection_id) = get_user_company_id()
  AND is_admin_or_owner()
);

CREATE POLICY "Admins can delete departments"
ON public.departments
FOR DELETE
USING (
  get_connection_company_id(whatsapp_connection_id) = get_user_company_id()
  AND is_admin_or_owner()
);

-- 11. ADICIONAR FK de department_id em conversations (se não existir a constraint)
ALTER TABLE public.conversations 
DROP CONSTRAINT IF EXISTS conversations_department_id_fkey;

ALTER TABLE public.conversations
ADD CONSTRAINT conversations_department_id_fkey 
FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;

-- 12. ATUALIZAR CONVERSAS EXISTENTES COM DEPARTMENT PADRÃO
UPDATE public.conversations c
SET department_id = (
  SELECT d.id 
  FROM public.departments d 
  WHERE d.whatsapp_connection_id = c.whatsapp_connection_id 
  AND d.is_default = true 
  LIMIT 1
)
WHERE c.department_id IS NULL 
AND c.whatsapp_connection_id IS NOT NULL;

-- 13. CRIAR ÍNDICES PARA PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_departments_connection_id ON public.departments(whatsapp_connection_id);
CREATE INDEX IF NOT EXISTS idx_departments_is_default ON public.departments(is_default) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_conversations_department_id ON public.conversations(department_id);