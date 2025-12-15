-- Add description and created_by columns to internal_chat_rooms
ALTER TABLE public.internal_chat_rooms 
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id);

-- Update the type column constraint to include 'group'
-- First, we need to update the RLS policies for group management

-- Drop existing policies that might conflict
DROP POLICY IF EXISTS "Users can create rooms in their company" ON public.internal_chat_rooms;
DROP POLICY IF EXISTS "Users can view rooms in their company" ON public.internal_chat_rooms;
DROP POLICY IF EXISTS "Admins can manage group rooms" ON public.internal_chat_rooms;
DROP POLICY IF EXISTS "Users can delete their direct rooms" ON public.internal_chat_rooms;
DROP POLICY IF EXISTS "Admins can update group rooms" ON public.internal_chat_rooms;

-- Policy: Users can view rooms they participate in (general, direct, or group they are members of)
CREATE POLICY "Users can view rooms in their company"
ON public.internal_chat_rooms
FOR SELECT
USING (
  (company_id = get_user_company_id()) 
  AND (
    -- General room is visible to all
    (type = 'general') 
    -- Direct rooms visible if user is participant
    OR (type = 'direct' AND EXISTS (
      SELECT 1 FROM internal_chat_participants p
      WHERE p.room_id = internal_chat_rooms.id AND p.user_id = auth.uid()
    ))
    -- Group rooms visible if user is participant
    OR (type = 'group' AND EXISTS (
      SELECT 1 FROM internal_chat_participants p
      WHERE p.room_id = internal_chat_rooms.id AND p.user_id = auth.uid()
    ))
  )
);

-- Policy: Anyone can create direct rooms, only admins can create groups
CREATE POLICY "Users can create rooms in their company"
ON public.internal_chat_rooms
FOR INSERT
WITH CHECK (
  (company_id IN (SELECT p.company_id FROM profiles p WHERE p.id = auth.uid()))
  AND (
    -- Direct rooms can be created by anyone
    (type = 'direct')
    -- General rooms can be created by anyone (but we handle uniqueness in app)
    OR (type = 'general')
    -- Group rooms can only be created by owner/admin
    OR (type = 'group' AND is_admin_or_owner())
  )
);

-- Policy: Only admins can update group rooms
CREATE POLICY "Admins can update group rooms"
ON public.internal_chat_rooms
FOR UPDATE
USING (
  company_id = get_user_company_id()
  AND type = 'group'
  AND is_admin_or_owner()
);

-- Policy: Only admins can delete group rooms
CREATE POLICY "Admins can delete group rooms"
ON public.internal_chat_rooms
FOR DELETE
USING (
  company_id = get_user_company_id()
  AND type = 'group'
  AND is_admin_or_owner()
);

-- Update participants policies for groups
DROP POLICY IF EXISTS "Users can add participants to their company rooms" ON public.internal_chat_participants;
DROP POLICY IF EXISTS "Admins can manage group participants" ON public.internal_chat_participants;
DROP POLICY IF EXISTS "Users can remove themselves from groups" ON public.internal_chat_participants;

-- Policy: Direct room participants can be added by anyone, group participants only by admin
CREATE POLICY "Users can add participants to their company rooms"
ON public.internal_chat_participants
FOR INSERT
WITH CHECK (
  room_belongs_to_user_company(room_id)
  AND (
    -- For direct rooms, anyone can add
    EXISTS (
      SELECT 1 FROM internal_chat_rooms r 
      WHERE r.id = room_id AND r.type IN ('direct', 'general')
    )
    -- For group rooms, only admin/owner can add
    OR (
      EXISTS (
        SELECT 1 FROM internal_chat_rooms r 
        WHERE r.id = room_id AND r.type = 'group'
      )
      AND is_admin_or_owner()
    )
  )
);

-- Policy: Only admins can remove participants from groups
CREATE POLICY "Admins can manage group participants"
ON public.internal_chat_participants
FOR DELETE
USING (
  room_belongs_to_user_company(room_id)
  AND EXISTS (
    SELECT 1 FROM internal_chat_rooms r 
    WHERE r.id = room_id AND r.type = 'group'
  )
  AND is_admin_or_owner()
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_internal_chat_rooms_type ON public.internal_chat_rooms(type);
CREATE INDEX IF NOT EXISTS idx_internal_chat_rooms_company_type ON public.internal_chat_rooms(company_id, type);