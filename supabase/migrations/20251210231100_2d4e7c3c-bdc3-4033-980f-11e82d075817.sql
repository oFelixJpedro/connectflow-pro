-- Create a SECURITY DEFINER function to create internal chat rooms
-- This bypasses RLS and ensures users can create rooms in their company
CREATE OR REPLACE FUNCTION public.create_internal_chat_room(
  p_type text,
  p_name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_room_id uuid;
BEGIN
  -- Get the user's company_id
  SELECT company_id INTO v_company_id
  FROM profiles
  WHERE id = auth.uid();
  
  -- Verify user has a company
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'User does not belong to a company';
  END IF;
  
  -- Create the room
  INSERT INTO internal_chat_rooms (company_id, type, name)
  VALUES (v_company_id, p_type, p_name)
  RETURNING id INTO v_room_id;
  
  RETURN v_room_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_internal_chat_room(text, text) TO authenticated;