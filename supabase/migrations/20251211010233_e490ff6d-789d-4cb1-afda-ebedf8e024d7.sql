-- Drop current INSERT policy and create a simpler one
DROP POLICY IF EXISTS "Users can create cards" ON public.kanban_cards;

-- Create simpler INSERT policy to test
CREATE POLICY "Users can create cards" 
ON public.kanban_cards 
FOR INSERT 
WITH CHECK (
  get_column_company_id(column_id) = get_user_company_id()
);