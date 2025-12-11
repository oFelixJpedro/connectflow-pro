-- Create table to track when users last viewed each internal chat room
CREATE TABLE public.internal_chat_read_states (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES public.internal_chat_rooms(id) ON DELETE CASCADE,
  last_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, room_id)
);

-- Enable RLS
ALTER TABLE public.internal_chat_read_states ENABLE ROW LEVEL SECURITY;

-- Users can view their own read states
CREATE POLICY "Users can view their own read states"
ON public.internal_chat_read_states
FOR SELECT
USING (user_id = auth.uid());

-- Users can insert their own read states
CREATE POLICY "Users can insert their own read states"
ON public.internal_chat_read_states
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Users can update their own read states
CREATE POLICY "Users can update their own read states"
ON public.internal_chat_read_states
FOR UPDATE
USING (user_id = auth.uid());

-- Create index for fast lookups
CREATE INDEX idx_internal_chat_read_states_user_room ON public.internal_chat_read_states(user_id, room_id);