-- Create chat_summaries table
CREATE TABLE public.chat_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL UNIQUE REFERENCES public.conversations(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  summary text NOT NULL,
  message_count integer NOT NULL DEFAULT 0,
  media_analyzed jsonb DEFAULT '{"images": 0, "videos": 0, "documents": 0}'::jsonb,
  generated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chat_summaries ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view summaries in their company
CREATE POLICY "Users can view chat summaries in their company"
ON public.chat_summaries
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = chat_summaries.conversation_id
    AND c.company_id = get_user_company_id()
  )
);

-- Policy: Users can insert summaries for conversations in their company
CREATE POLICY "Users can insert chat summaries"
ON public.chat_summaries
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = chat_summaries.conversation_id
    AND c.company_id = get_user_company_id()
  )
);

-- Policy: Users can update summaries in their company
CREATE POLICY "Users can update chat summaries"
ON public.chat_summaries
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = chat_summaries.conversation_id
    AND c.company_id = get_user_company_id()
  )
);

-- Create index for faster lookups
CREATE INDEX idx_chat_summaries_conversation_id ON public.chat_summaries(conversation_id);

-- Create trigger for updated_at
CREATE TRIGGER update_chat_summaries_updated_at
  BEFORE UPDATE ON public.chat_summaries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();