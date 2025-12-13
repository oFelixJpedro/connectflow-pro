-- Create table for conversation followers
CREATE TABLE public.conversation_followers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, user_id)
);

-- Create indexes for performance
CREATE INDEX idx_conversation_followers_conversation_id ON public.conversation_followers(conversation_id);
CREATE INDEX idx_conversation_followers_user_id ON public.conversation_followers(user_id);

-- Enable RLS
ALTER TABLE public.conversation_followers ENABLE ROW LEVEL SECURITY;

-- Users can only view their own follows
CREATE POLICY "Users can view their own follows"
ON public.conversation_followers
FOR SELECT
USING (user_id = auth.uid());

-- Users can only create their own follows (admin/owner check done at app level)
CREATE POLICY "Users can create their own follows"
ON public.conversation_followers
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Users can only delete their own follows
CREATE POLICY "Users can delete their own follows"
ON public.conversation_followers
FOR DELETE
USING (user_id = auth.uid());