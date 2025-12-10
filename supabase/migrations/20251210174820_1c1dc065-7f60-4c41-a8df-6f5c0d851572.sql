-- Create message_reactions table for storing WhatsApp reactions
CREATE TABLE public.message_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  reactor_type VARCHAR(10) NOT NULL CHECK (reactor_type IN ('contact', 'user')),
  reactor_id UUID NOT NULL,
  emoji VARCHAR(50) NOT NULL,
  whatsapp_message_id VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique constraint: one reaction per person per message
CREATE UNIQUE INDEX idx_message_reactions_unique_reactor 
ON public.message_reactions(message_id, reactor_type, reactor_id);

-- Create indexes for performance
CREATE INDEX idx_message_reactions_message_id ON public.message_reactions(message_id);
CREATE INDEX idx_message_reactions_company_id ON public.message_reactions(company_id);

-- Enable Row Level Security
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view reactions in their company"
ON public.message_reactions
FOR SELECT
USING (company_id = get_user_company_id());

CREATE POLICY "Users can create reactions in their company"
ON public.message_reactions
FOR INSERT
WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Users can update reactions in their company"
ON public.message_reactions
FOR UPDATE
USING (company_id = get_user_company_id());

CREATE POLICY "Users can delete reactions in their company"
ON public.message_reactions
FOR DELETE
USING (company_id = get_user_company_id());

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_message_reactions_updated_at
BEFORE UPDATE ON public.message_reactions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for reactions
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;

-- Set replica identity for realtime
ALTER TABLE public.message_reactions REPLICA IDENTITY FULL;