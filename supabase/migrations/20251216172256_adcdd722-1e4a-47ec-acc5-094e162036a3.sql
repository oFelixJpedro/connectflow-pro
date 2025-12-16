-- Allow users to read roles for team members in their company
CREATE POLICY "Users can view roles in their company"
ON public.user_roles
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = user_roles.user_id
      AND p.company_id = public.get_user_company_id()
  )
);