
-- Remover política de INSERT existente e criar uma nova PERMISSIVE
DROP POLICY IF EXISTS "Users can create rooms in their company" ON public.internal_chat_rooms;

-- Criar política PERMISSIVE que permite todos os membros da empresa criarem salas
CREATE POLICY "Users can create rooms in their company"
ON public.internal_chat_rooms
FOR INSERT
TO authenticated
WITH CHECK (company_id = get_user_company_id());
