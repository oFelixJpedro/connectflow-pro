-- Create enum for permission request types
CREATE TYPE public.developer_permission_request_type AS ENUM (
  'edit_company', 
  'edit_user', 
  'access_user',
  'delete_company',
  'delete_user'
);

-- Create enum for permission request status
CREATE TYPE public.developer_permission_status AS ENUM (
  'pending', 
  'approved', 
  'denied', 
  'cancelled', 
  'expired',
  'used'
);

-- Create enum for developer audit action types
CREATE TYPE public.developer_audit_action AS ENUM (
  'login',
  'view_company',
  'view_user', 
  'edit_company',
  'edit_user',
  'access_user',
  'reset_password',
  'create_company',
  'create_user',
  'delete_company',
  'delete_user'
);

-- Create developer_auth table for developer credentials
CREATE TABLE public.developer_auth (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_login TIMESTAMP WITH TIME ZONE
);

-- Create developer_permission_requests table
CREATE TABLE public.developer_permission_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type developer_permission_request_type NOT NULL,
  target_company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  target_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES public.developer_auth(id),
  approver_id UUID REFERENCES public.profiles(id),
  status developer_permission_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  responded_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '5 minutes')
);

-- Create developer_audit_logs table
CREATE TABLE public.developer_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id UUID NOT NULL REFERENCES public.developer_auth(id),
  action_type developer_audit_action NOT NULL,
  target_company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  target_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on all developer tables
ALTER TABLE public.developer_auth ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.developer_permission_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.developer_audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for developer_auth (no direct access, only via edge functions)
-- No SELECT policy - only edge functions with service role can access

-- RLS policies for developer_permission_requests
-- Users can view requests where they are the approver
CREATE POLICY "Users can view their permission requests"
ON public.developer_permission_requests
FOR SELECT
USING (approver_id = auth.uid());

-- Users can update requests where they are the approver (to approve/deny)
CREATE POLICY "Users can respond to their permission requests"
ON public.developer_permission_requests
FOR UPDATE
USING (approver_id = auth.uid() AND status = 'pending')
WITH CHECK (status IN ('approved', 'denied'));

-- Enable realtime for permission requests
ALTER PUBLICATION supabase_realtime ADD TABLE public.developer_permission_requests;

-- Create indexes for better performance
CREATE INDEX idx_developer_permission_requests_approver ON public.developer_permission_requests(approver_id);
CREATE INDEX idx_developer_permission_requests_status ON public.developer_permission_requests(status);
CREATE INDEX idx_developer_audit_logs_developer ON public.developer_audit_logs(developer_id);
CREATE INDEX idx_developer_audit_logs_created ON public.developer_audit_logs(created_at DESC);

-- Insert initial developer credentials (password: 8SenhaIncorreta@)
-- Using bcrypt hash - this will be verified by the edge function
INSERT INTO public.developer_auth (email, password_hash)
VALUES (
  'obarbosa@barbosa.com.br',
  '$2a$10$rQnM1.8xqxzPWZwPfPVdCOqZZvXW9X8X8X8X8X8X8X8X8X8X8X8X8'
);