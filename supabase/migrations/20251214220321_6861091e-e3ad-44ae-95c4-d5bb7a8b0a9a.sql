-- Add mentions column to messages table (for internal notes)
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS mentions JSONB DEFAULT '[]'::jsonb;

-- Add mentions column to internal_chat_messages table
ALTER TABLE public.internal_chat_messages 
ADD COLUMN IF NOT EXISTS mentions JSONB DEFAULT '[]'::jsonb;

-- Create mention_notifications table for tracking mentions
CREATE TABLE IF NOT EXISTS public.mention_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentioned_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mentioner_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('internal_note', 'internal_chat')),
  message_id UUID NOT NULL,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  room_id UUID REFERENCES public.internal_chat_rooms(id) ON DELETE CASCADE,
  has_access BOOLEAN NOT NULL DEFAULT true,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on mention_notifications
ALTER TABLE public.mention_notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own mention notifications
CREATE POLICY "Users can view their own mention notifications"
ON public.mention_notifications
FOR SELECT
USING (mentioned_user_id = auth.uid());

-- Policy: Users can mark their own notifications as read
CREATE POLICY "Users can update their own mention notifications"
ON public.mention_notifications
FOR UPDATE
USING (mentioned_user_id = auth.uid());

-- Policy: Any authenticated user can create mention notifications
CREATE POLICY "Authenticated users can create mention notifications"
ON public.mention_notifications
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_mention_notifications_user_unread 
ON public.mention_notifications (mentioned_user_id, is_read) 
WHERE is_read = false;

CREATE INDEX IF NOT EXISTS idx_mention_notifications_created_at 
ON public.mention_notifications (created_at DESC);

-- Add realtime for mention_notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.mention_notifications;