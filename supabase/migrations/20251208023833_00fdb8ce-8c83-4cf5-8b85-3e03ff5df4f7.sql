-- Create connection_users table
CREATE TABLE public.connection_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.whatsapp_connections(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE (connection_id, user_id)
);

-- Create indexes for performance
CREATE INDEX idx_connection_users_connection_id ON public.connection_users(connection_id);
CREATE INDEX idx_connection_users_user_id ON public.connection_users(user_id);

-- Enable RLS
ALTER TABLE public.connection_users ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view connection_users if they belong to the same company as the connection
CREATE POLICY "Users can view connection_users in their company"
ON public.connection_users
FOR SELECT
USING (
  get_connection_company_id(connection_id) = get_user_company_id()
);

-- Policy: Only owner/admin can insert connection_users
CREATE POLICY "Admins can insert connection_users"
ON public.connection_users
FOR INSERT
WITH CHECK (
  get_connection_company_id(connection_id) = get_user_company_id() 
  AND is_admin_or_owner()
);

-- Policy: Only owner/admin can delete connection_users
CREATE POLICY "Admins can delete connection_users"
ON public.connection_users
FOR DELETE
USING (
  get_connection_company_id(connection_id) = get_user_company_id() 
  AND is_admin_or_owner()
);