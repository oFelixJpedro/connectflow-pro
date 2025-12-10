-- Drop and recreate INSERT policy with inline check instead of function
DROP POLICY IF EXISTS "Users can create rooms in their company" ON public.internal_chat_rooms;

CREATE POLICY "Users can create rooms in their company" 
ON public.internal_chat_rooms
FOR INSERT 
TO authenticated
WITH CHECK (
  company_id IN (
    SELECT p.company_id 
    FROM public.profiles p 
    WHERE p.id = auth.uid()
  )
);