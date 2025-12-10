
-- Corrigir RLS de internal_chat_rooms para que salas diretas só sejam visíveis aos participantes
DROP POLICY IF EXISTS "Users can view rooms in their company" ON public.internal_chat_rooms;

-- Nova policy: salas gerais são visíveis para todos da empresa, salas diretas apenas para participantes
CREATE POLICY "Users can view rooms in their company"
ON public.internal_chat_rooms
FOR SELECT
TO authenticated
USING (
  company_id = get_user_company_id()
  AND (
    type = 'general'
    OR EXISTS (
      SELECT 1 FROM internal_chat_participants p
      WHERE p.room_id = internal_chat_rooms.id
      AND p.user_id = auth.uid()
    )
  )
);
