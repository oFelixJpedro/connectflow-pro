-- Create agent_behavior_alerts table for tracking problematic behaviors
CREATE TABLE public.agent_behavior_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  alert_type VARCHAR NOT NULL, -- 'aggressive', 'negligent', 'lazy', 'slow_response', 'sabotage', 'quality_issue', 'unprofessional'
  severity VARCHAR NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  title VARCHAR NOT NULL,
  description TEXT NOT NULL,
  message_excerpt TEXT, -- Excerpt of the problematic message
  message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  ai_confidence NUMERIC DEFAULT 0.5, -- 0-1 confidence level
  lead_was_rude BOOLEAN DEFAULT false, -- Context: if lead was disrespectful first
  reviewed BOOLEAN DEFAULT false, -- If admin reviewed this alert
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add indexes
CREATE INDEX idx_agent_behavior_alerts_company_id ON public.agent_behavior_alerts(company_id);
CREATE INDEX idx_agent_behavior_alerts_agent_id ON public.agent_behavior_alerts(agent_id);
CREATE INDEX idx_agent_behavior_alerts_severity ON public.agent_behavior_alerts(severity);
CREATE INDEX idx_agent_behavior_alerts_detected_at ON public.agent_behavior_alerts(detected_at DESC);

-- Enable RLS
ALTER TABLE public.agent_behavior_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can view alerts in their company"
ON public.agent_behavior_alerts
FOR SELECT
USING ((company_id = get_user_company_id()) AND is_admin_or_owner());

CREATE POLICY "Admins can update alerts in their company"
ON public.agent_behavior_alerts
FOR UPDATE
USING ((company_id = get_user_company_id()) AND is_admin_or_owner());

CREATE POLICY "System can insert alerts"
ON public.agent_behavior_alerts
FOR INSERT
WITH CHECK (true);

-- Add agent_id to conversation_evaluations table
ALTER TABLE public.conversation_evaluations 
ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Add index for agent_id in evaluations
CREATE INDEX IF NOT EXISTS idx_conversation_evaluations_agent_id ON public.conversation_evaluations(agent_id);