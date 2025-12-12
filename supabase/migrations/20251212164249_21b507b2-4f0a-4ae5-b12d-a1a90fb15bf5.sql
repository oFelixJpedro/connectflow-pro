-- Create visibility type enum
CREATE TYPE public.quick_reply_visibility AS ENUM ('all', 'personal', 'department', 'connection');

-- Add visibility columns to quick_replies table
ALTER TABLE public.quick_replies 
ADD COLUMN visibility_type public.quick_reply_visibility NOT NULL DEFAULT 'all',
ADD COLUMN department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
ADD COLUMN whatsapp_connection_id uuid REFERENCES public.whatsapp_connections(id) ON DELETE SET NULL;

-- Migrate existing data: is_global=true -> 'all', is_global=false -> 'personal'
UPDATE public.quick_replies 
SET visibility_type = CASE 
  WHEN is_global = true THEN 'all'::public.quick_reply_visibility
  ELSE 'personal'::public.quick_reply_visibility
END;

-- Create indexes for performance
CREATE INDEX idx_quick_replies_visibility ON public.quick_replies(visibility_type);
CREATE INDEX idx_quick_replies_department ON public.quick_replies(department_id) WHERE department_id IS NOT NULL;
CREATE INDEX idx_quick_replies_connection ON public.quick_replies(whatsapp_connection_id) WHERE whatsapp_connection_id IS NOT NULL;

-- Drop old RLS policies and create new ones that respect visibility
DROP POLICY IF EXISTS "Admins can manage all quick replies" ON public.quick_replies;
DROP POLICY IF EXISTS "Users can create quick replies" ON public.quick_replies;
DROP POLICY IF EXISTS "Users can update their quick replies" ON public.quick_replies;
DROP POLICY IF EXISTS "Users can view quick replies" ON public.quick_replies;

-- SELECT policy: users can view based on visibility
CREATE POLICY "Users can view quick replies by visibility" 
ON public.quick_replies 
FOR SELECT 
USING (
  company_id = get_user_company_id() AND (
    -- All: visible to everyone in company
    visibility_type = 'all' OR
    -- Personal: only creator
    (visibility_type = 'personal' AND created_by_user_id = auth.uid()) OR
    -- Department: members of the same department
    (visibility_type = 'department' AND department_id IN (
      SELECT department_id FROM public.department_users WHERE user_id = auth.uid()
    )) OR
    -- Connection: users with access to connection
    (visibility_type = 'connection' AND (
      is_admin_or_owner() OR 
      whatsapp_connection_id IN (
        SELECT connection_id FROM public.connection_users WHERE user_id = auth.uid()
      )
    )) OR
    -- Admins can see all
    is_admin_or_owner()
  )
);

-- INSERT policy: users can create in their company
CREATE POLICY "Users can create quick replies" 
ON public.quick_replies 
FOR INSERT 
WITH CHECK (company_id = get_user_company_id());

-- UPDATE policy: creator or admin can update
CREATE POLICY "Users can update quick replies" 
ON public.quick_replies 
FOR UPDATE 
USING (
  company_id = get_user_company_id() AND (
    created_by_user_id = auth.uid() OR 
    is_admin_or_owner()
  )
);

-- DELETE policy: creator or admin can delete
CREATE POLICY "Users can delete quick replies" 
ON public.quick_replies 
FOR DELETE 
USING (
  company_id = get_user_company_id() AND (
    created_by_user_id = auth.uid() OR 
    is_admin_or_owner()
  )
);