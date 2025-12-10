
-- Create internal chat rooms table
CREATE TABLE public.internal_chat_rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  type VARCHAR NOT NULL CHECK (type IN ('general', 'direct')),
  name VARCHAR,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create participants table for direct chats
CREATE TABLE public.internal_chat_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.internal_chat_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(room_id, user_id)
);

-- Create internal chat messages table
CREATE TABLE public.internal_chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.internal_chat_rooms(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT,
  message_type VARCHAR NOT NULL DEFAULT 'text',
  media_url TEXT,
  media_mime_type VARCHAR,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.internal_chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for internal_chat_rooms
CREATE POLICY "Users can view rooms in their company"
ON public.internal_chat_rooms FOR SELECT
USING (company_id = get_user_company_id());

CREATE POLICY "Users can create rooms in their company"
ON public.internal_chat_rooms FOR INSERT
WITH CHECK (company_id = get_user_company_id());

-- RLS Policies for internal_chat_participants
CREATE POLICY "Users can view participants in their company rooms"
ON public.internal_chat_participants FOR SELECT
USING (EXISTS (
  SELECT 1 FROM internal_chat_rooms r
  WHERE r.id = room_id AND r.company_id = get_user_company_id()
));

CREATE POLICY "Users can add participants to their company rooms"
ON public.internal_chat_participants FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM internal_chat_rooms r
  WHERE r.id = room_id AND r.company_id = get_user_company_id()
));

-- RLS Policies for internal_chat_messages
CREATE POLICY "Users can view messages in their company rooms"
ON public.internal_chat_messages FOR SELECT
USING (EXISTS (
  SELECT 1 FROM internal_chat_rooms r
  WHERE r.id = room_id AND r.company_id = get_user_company_id()
));

CREATE POLICY "Users can send messages to their company rooms"
ON public.internal_chat_messages FOR INSERT
WITH CHECK (
  sender_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM internal_chat_rooms r
    WHERE r.id = room_id AND r.company_id = get_user_company_id()
  )
);

-- Indexes for performance
CREATE INDEX idx_internal_chat_rooms_company ON public.internal_chat_rooms(company_id);
CREATE INDEX idx_internal_chat_messages_room ON public.internal_chat_messages(room_id);
CREATE INDEX idx_internal_chat_messages_created ON public.internal_chat_messages(created_at DESC);
CREATE INDEX idx_internal_chat_participants_room ON public.internal_chat_participants(room_id);
CREATE INDEX idx_internal_chat_participants_user ON public.internal_chat_participants(user_id);

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE internal_chat_messages;
