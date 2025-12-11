-- Create helper function to get company_id from column_id
CREATE OR REPLACE FUNCTION public.get_column_company_id(p_column_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT kb.company_id 
  FROM public.kanban_columns kcol
  JOIN public.kanban_boards kb ON kcol.board_id = kb.id
  WHERE kcol.id = p_column_id
$$;

-- Drop the broken INSERT policy
DROP POLICY IF EXISTS "Users can create cards" ON public.kanban_cards;

-- Create fixed INSERT policy that checks column_id instead of card id
CREATE POLICY "Users can create cards" 
ON public.kanban_cards 
FOR INSERT 
WITH CHECK (
  (get_column_company_id(column_id) = get_user_company_id()) 
  AND has_crm_access()
);