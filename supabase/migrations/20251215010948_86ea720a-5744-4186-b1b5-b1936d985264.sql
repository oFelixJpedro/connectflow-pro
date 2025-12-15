-- Update the create_internal_chat_room function to support description parameter
CREATE OR REPLACE FUNCTION public.create_internal_chat_room(
  p_type text,
  p_name text DEFAULT NULL,
  p_description text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_room_id uuid;
  v_user_id uuid;
  v_is_admin_or_owner boolean;
BEGIN
  v_user_id := auth.uid();
  
  -- Get the user's company_id
  SELECT company_id INTO v_company_id
  FROM profiles
  WHERE id = v_user_id;
  
  -- Verify user has a company
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'User does not belong to a company';
  END IF;
  
  -- Para grupos, verificar se usuário é admin ou owner
  IF p_type = 'group' THEN
    SELECT EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = v_user_id 
      AND role IN ('owner', 'admin')
    ) INTO v_is_admin_or_owner;
    
    IF NOT v_is_admin_or_owner THEN
      RAISE EXCEPTION 'Only owners and admins can create groups';
    END IF;
  END IF;
  
  -- Create the room with all fields
  INSERT INTO internal_chat_rooms (company_id, type, name, description, created_by)
  VALUES (v_company_id, p_type, p_name, p_description, v_user_id)
  RETURNING id INTO v_room_id;
  
  RETURN v_room_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_internal_chat_room(text, text, text) TO authenticated;