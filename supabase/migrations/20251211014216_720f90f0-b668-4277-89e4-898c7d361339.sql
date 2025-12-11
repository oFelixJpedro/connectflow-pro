-- Update has_crm_access function to check connection_users.crm_access
-- This function now takes an optional connection_id parameter
-- If no connection_id is provided, it checks if user has CRM access to ANY connection

-- First, create a new function that checks CRM access for a specific connection
CREATE OR REPLACE FUNCTION public.has_crm_access_for_connection(p_connection_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_role app_role;
BEGIN
  -- Get user role
  SELECT role INTO user_role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1;
  
  -- Owner and admin always have access
  IF user_role IN ('owner', 'admin') THEN
    RETURN true;
  END IF;
  
  -- Check connection_users table for crm_access
  RETURN EXISTS (
    SELECT 1 FROM public.connection_users
    WHERE user_id = auth.uid() 
    AND connection_id = p_connection_id
    AND crm_access = true
  );
END;
$$;

-- Update has_crm_access to check if user has CRM access to at least one connection
CREATE OR REPLACE FUNCTION public.has_crm_access()
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_role app_role;
BEGIN
  -- Get user role
  SELECT role INTO user_role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1;
  
  -- Owner and admin always have access
  IF user_role IN ('owner', 'admin') THEN
    RETURN true;
  END IF;
  
  -- Check if user has crm_access on any connection
  RETURN EXISTS (
    SELECT 1 FROM public.connection_users
    WHERE user_id = auth.uid() 
    AND crm_access = true
  );
END;
$$;

-- Drop existing policies on kanban_boards
DROP POLICY IF EXISTS "Users can view boards in their company" ON public.kanban_boards;

-- Create new policy that checks per-connection CRM access
CREATE POLICY "Users can view boards with CRM access"
ON public.kanban_boards
FOR SELECT
USING (
  company_id = get_user_company_id() 
  AND has_crm_access_for_connection(whatsapp_connection_id)
);

-- Drop existing policies on kanban_columns
DROP POLICY IF EXISTS "Users can view columns" ON public.kanban_columns;

-- Create new policy for columns that checks per-connection CRM access
CREATE POLICY "Users can view columns with CRM access"
ON public.kanban_columns
FOR SELECT
USING (
  get_board_company_id(board_id) = get_user_company_id()
  AND EXISTS (
    SELECT 1 FROM public.kanban_boards kb
    WHERE kb.id = board_id
    AND has_crm_access_for_connection(kb.whatsapp_connection_id)
  )
);