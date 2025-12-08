-- Create department_users table for department-level access control
CREATE TABLE public.department_users (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE(department_id, user_id)
);

-- Enable RLS
ALTER TABLE public.department_users ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view department_users in their company (via department -> connection -> company)
CREATE POLICY "Users can view department_users in their company"
ON public.department_users
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM departments d
        WHERE d.id = department_users.department_id
        AND get_connection_company_id(d.whatsapp_connection_id) = get_user_company_id()
    )
);

-- Admins can insert department_users
CREATE POLICY "Admins can insert department_users"
ON public.department_users
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM departments d
        WHERE d.id = department_users.department_id
        AND get_connection_company_id(d.whatsapp_connection_id) = get_user_company_id()
    )
    AND is_admin_or_owner()
);

-- Admins can delete department_users
CREATE POLICY "Admins can delete department_users"
ON public.department_users
FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM departments d
        WHERE d.id = department_users.department_id
        AND get_connection_company_id(d.whatsapp_connection_id) = get_user_company_id()
    )
    AND is_admin_or_owner()
);

-- Add index for performance
CREATE INDEX idx_department_users_user_id ON public.department_users(user_id);
CREATE INDEX idx_department_users_department_id ON public.department_users(department_id);