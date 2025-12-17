-- Create scheduled_messages table
CREATE TABLE public.scheduled_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  
  -- Message content
  message_type TEXT NOT NULL DEFAULT 'text',
  content TEXT,
  media_url TEXT,
  media_mime_type TEXT,
  media_file_name TEXT,
  
  -- Scheduling
  scheduled_at TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  
  -- Control
  status TEXT NOT NULL DEFAULT 'pending',
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Result
  sent_at TIMESTAMPTZ,
  sent_message_id UUID,
  error_message TEXT,
  
  -- Cancellation
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES public.profiles(id)
);

-- Indexes for performance
CREATE INDEX idx_scheduled_messages_status ON public.scheduled_messages(status);
CREATE INDEX idx_scheduled_messages_scheduled_at ON public.scheduled_messages(scheduled_at);
CREATE INDEX idx_scheduled_messages_contact ON public.scheduled_messages(contact_id);
CREATE INDEX idx_scheduled_messages_company ON public.scheduled_messages(company_id);
CREATE INDEX idx_scheduled_messages_pending ON public.scheduled_messages(scheduled_at) WHERE status = 'pending';

-- Enable RLS
ALTER TABLE public.scheduled_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view scheduled messages in their company"
  ON public.scheduled_messages FOR SELECT
  USING (company_id = get_user_company_id());

CREATE POLICY "Users can create scheduled messages"
  ON public.scheduled_messages FOR INSERT
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Users can update scheduled messages in their company"
  ON public.scheduled_messages FOR UPDATE
  USING (company_id = get_user_company_id());

CREATE POLICY "Users can delete scheduled messages in their company"
  ON public.scheduled_messages FOR DELETE
  USING (company_id = get_user_company_id());

-- Create storage bucket for scheduled message media
INSERT INTO storage.buckets (id, name, public)
VALUES ('scheduled-messages-media', 'scheduled-messages-media', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users can upload scheduled message media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'scheduled-messages-media');

CREATE POLICY "Users can read scheduled message media"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'scheduled-messages-media');

CREATE POLICY "Users can delete scheduled message media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'scheduled-messages-media');