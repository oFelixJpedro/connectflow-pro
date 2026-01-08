-- Create calendar_events table
CREATE TABLE public.calendar_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  summary TEXT,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  all_day BOOLEAN DEFAULT false,
  location TEXT,
  event_type VARCHAR(50) DEFAULT 'meeting' CHECK (event_type IN ('meeting', 'reminder', 'task', 'other')),
  status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  color VARCHAR(20) DEFAULT '#3b82f6',
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  google_event_id VARCHAR(255),
  google_calendar_synced BOOLEAN DEFAULT false,
  reminder_minutes INTEGER DEFAULT 30,
  recurrence_rule TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create calendar_google_tokens table
CREATE TABLE public.calendar_google_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  google_email VARCHAR(255),
  connected_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create calendar_event_attendees table
CREATE TABLE public.calendar_event_attendees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  email VARCHAR(255),
  name VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'tentative')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_calendar_events_company_id ON public.calendar_events(company_id);
CREATE INDEX idx_calendar_events_start_date ON public.calendar_events(start_date);
CREATE INDEX idx_calendar_events_end_date ON public.calendar_events(end_date);
CREATE INDEX idx_calendar_events_assigned_to ON public.calendar_events(assigned_to);
CREATE INDEX idx_calendar_events_contact_id ON public.calendar_events(contact_id);
CREATE INDEX idx_calendar_events_google_event_id ON public.calendar_events(google_event_id);
CREATE INDEX idx_calendar_event_attendees_event_id ON public.calendar_event_attendees(event_id);

-- Enable RLS
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_google_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_event_attendees ENABLE ROW LEVEL SECURITY;

-- RLS Policies for calendar_events
CREATE POLICY "Users can view their company events"
  ON public.calendar_events FOR SELECT
  USING (company_id = get_user_company_id());

CREATE POLICY "Users can create events for their company"
  ON public.calendar_events FOR INSERT
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Users can update their company events"
  ON public.calendar_events FOR UPDATE
  USING (company_id = get_user_company_id());

CREATE POLICY "Users can delete their company events"
  ON public.calendar_events FOR DELETE
  USING (company_id = get_user_company_id());

-- RLS Policies for calendar_google_tokens (only owner/admin)
CREATE POLICY "Owner/Admin can view google tokens"
  ON public.calendar_google_tokens FOR SELECT
  USING (company_id = get_user_company_id() AND is_admin_or_owner());

CREATE POLICY "Owner/Admin can insert google tokens"
  ON public.calendar_google_tokens FOR INSERT
  WITH CHECK (company_id = get_user_company_id() AND is_admin_or_owner());

CREATE POLICY "Owner/Admin can update google tokens"
  ON public.calendar_google_tokens FOR UPDATE
  USING (company_id = get_user_company_id() AND is_admin_or_owner());

CREATE POLICY "Owner/Admin can delete google tokens"
  ON public.calendar_google_tokens FOR DELETE
  USING (company_id = get_user_company_id() AND is_admin_or_owner());

-- RLS Policies for calendar_event_attendees
CREATE POLICY "Users can view attendees of their company events"
  ON public.calendar_event_attendees FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.calendar_events e
    WHERE e.id = event_id 
    AND e.company_id = get_user_company_id()
  ));

CREATE POLICY "Users can insert attendees to their company events"
  ON public.calendar_event_attendees FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.calendar_events e
    WHERE e.id = event_id 
    AND e.company_id = get_user_company_id()
  ));

CREATE POLICY "Users can update attendees of their company events"
  ON public.calendar_event_attendees FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.calendar_events e
    WHERE e.id = event_id 
    AND e.company_id = get_user_company_id()
  ));

CREATE POLICY "Users can delete attendees of their company events"
  ON public.calendar_event_attendees FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.calendar_events e
    WHERE e.id = event_id 
    AND e.company_id = get_user_company_id()
  ));

-- Trigger for updated_at
CREATE TRIGGER update_calendar_events_updated_at
  BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_calendar_google_tokens_updated_at
  BEFORE UPDATE ON public.calendar_google_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for calendar_events
ALTER TABLE public.calendar_events REPLICA IDENTITY FULL;