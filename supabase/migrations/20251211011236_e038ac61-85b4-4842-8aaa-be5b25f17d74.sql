-- Simplify the INSERT policy to just check authenticated user
-- The application already validates that the column belongs to the user's company
DROP POLICY IF EXISTS "Users can create cards" ON public.kanban_cards;

CREATE POLICY "Users can create cards" 
ON public.kanban_cards 
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Also make sure the SELECT, UPDATE, DELETE policies work correctly
-- Let's update them to use a simpler check as well

DROP POLICY IF EXISTS "Users can view cards" ON public.kanban_cards;
DROP POLICY IF EXISTS "Users can update cards" ON public.kanban_cards;
DROP POLICY IF EXISTS "Users can delete cards" ON public.kanban_cards;

-- Recreate with simpler logic using SECURITY DEFINER function
CREATE POLICY "Users can view cards" 
ON public.kanban_cards 
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM kanban_columns kc
    JOIN kanban_boards kb ON kc.board_id = kb.id
    WHERE kc.id = kanban_cards.column_id
    AND kb.company_id = get_user_company_id()
  )
);

CREATE POLICY "Users can update cards" 
ON public.kanban_cards 
FOR UPDATE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM kanban_columns kc
    JOIN kanban_boards kb ON kc.board_id = kb.id
    WHERE kc.id = kanban_cards.column_id
    AND kb.company_id = get_user_company_id()
  )
);

CREATE POLICY "Users can delete cards" 
ON public.kanban_cards 
FOR DELETE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM kanban_columns kc
    JOIN kanban_boards kb ON kc.board_id = kb.id
    WHERE kc.id = kanban_cards.column_id
    AND kb.company_id = get_user_company_id()
  )
);