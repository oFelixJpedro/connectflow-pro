-- Let's try a completely different approach for the INSERT policy
-- First drop the existing one
DROP POLICY IF EXISTS "Users can create cards" ON public.kanban_cards;

-- Create a new policy that checks the relationship more directly
CREATE POLICY "Users can create cards" 
ON public.kanban_cards 
FOR INSERT 
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM kanban_columns kc
    JOIN kanban_boards kb ON kc.board_id = kb.id
    JOIN profiles p ON p.company_id = kb.company_id
    WHERE kc.id = column_id
    AND p.id = auth.uid()
  )
);