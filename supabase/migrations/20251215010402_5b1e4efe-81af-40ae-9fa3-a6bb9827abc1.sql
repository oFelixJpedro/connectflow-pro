-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Users can create rooms in their company" ON public.internal_chat_rooms;

-- Create new INSERT policy with inline role verification
CREATE POLICY "Users can create rooms in their company" 
ON public.internal_chat_rooms
FOR INSERT 
TO authenticated
WITH CHECK (
  -- Verificar que company_id pertence ao usuário
  company_id IN (SELECT p.company_id FROM profiles p WHERE p.id = auth.uid())
  AND (
    -- Qualquer um pode criar rooms diretos ou general
    type = 'direct'
    OR type = 'general'
    -- Apenas owner/admin podem criar grupos (verificação inline)
    OR (
      type = 'group' 
      AND EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth.uid() 
        AND role IN ('owner', 'admin')
      )
    )
  )
);