-- Create a security definer function to check if user can access column
CREATE OR REPLACE FUNCTION public.can_user_access_column(p_column_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM kanban_columns kc
    JOIN kanban_boards kb ON kc.board_id = kb.id
    JOIN profiles p ON p.company_id = kb.company_id
    WHERE kc.id = p_column_id 
    AND p.id = auth.uid()
  )
$$;

-- Drop and recreate the INSERT policy using the function
DROP POLICY IF EXISTS "Users can create cards" ON public.kanban_cards;

CREATE POLICY "Users can create cards" 
ON public.kanban_cards 
FOR INSERT 
TO authenticated
WITH CHECK (can_user_access_column(column_id));