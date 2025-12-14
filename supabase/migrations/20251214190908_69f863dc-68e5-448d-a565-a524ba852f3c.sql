-- First, let's clean up the orphan rooms without participants
DELETE FROM internal_chat_rooms
WHERE id NOT IN (
  SELECT DISTINCT room_id FROM internal_chat_participants
);

-- Update RLS policy for internal_chat_participants to allow adding to direct rooms
DROP POLICY IF EXISTS "Users can add participants to their company rooms" ON public.internal_chat_participants;

CREATE POLICY "Users can add participants to their company rooms"
ON public.internal_chat_participants
FOR INSERT
WITH CHECK (
  room_belongs_to_user_company(room_id)
);

-- Ensure general room has all company members as participants
-- This will be handled by the app when the general room is accessed