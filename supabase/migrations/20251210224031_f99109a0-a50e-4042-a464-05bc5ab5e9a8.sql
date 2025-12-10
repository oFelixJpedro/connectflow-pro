
-- Criar função SECURITY DEFINER para verificar se uma sala pertence à empresa do usuário
-- Isso evita a dependência circular com a RLS de internal_chat_rooms
CREATE OR REPLACE FUNCTION public.room_belongs_to_user_company(room_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.internal_chat_rooms
    WHERE id = room_id
    AND company_id = get_user_company_id()
  )
$$;

-- Atualizar RLS de internal_chat_participants para usar a nova função
DROP POLICY IF EXISTS "Users can view participants in their company rooms" ON public.internal_chat_participants;

CREATE POLICY "Users can view participants in their company rooms"
ON public.internal_chat_participants
FOR SELECT
TO authenticated
USING (room_belongs_to_user_company(room_id));

-- Atualizar RLS de internal_chat_messages para usar a nova função
DROP POLICY IF EXISTS "Users can view messages in their company rooms" ON public.internal_chat_messages;

CREATE POLICY "Users can view messages in their company rooms"
ON public.internal_chat_messages
FOR SELECT
TO authenticated
USING (room_belongs_to_user_company(room_id));

-- Atualizar INSERT policies também
DROP POLICY IF EXISTS "Users can add participants to their company rooms" ON public.internal_chat_participants;

CREATE POLICY "Users can add participants to their company rooms"
ON public.internal_chat_participants
FOR INSERT
TO authenticated
WITH CHECK (room_belongs_to_user_company(room_id));

DROP POLICY IF EXISTS "Users can send messages to their company rooms" ON public.internal_chat_messages;

CREATE POLICY "Users can send messages to their company rooms"
ON public.internal_chat_messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid() 
  AND room_belongs_to_user_company(room_id)
);
