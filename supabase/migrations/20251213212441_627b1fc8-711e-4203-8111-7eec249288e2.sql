-- Add DELETE policy for profiles table
-- Owner can delete any user except themselves
-- Admin can delete only agents (supervisor) and viewers, not owner or other admins

CREATE POLICY "Owner can delete users except themselves"
ON public.profiles
FOR DELETE
USING (
  (company_id = get_user_company_id())
  AND (id != auth.uid())
  AND (get_user_role() = 'owner')
);

CREATE POLICY "Admin can delete agents and viewers only"
ON public.profiles
FOR DELETE
USING (
  (company_id = get_user_company_id())
  AND (id != auth.uid())
  AND (get_user_role() = 'admin')
  AND (
    NOT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = profiles.id
      AND role IN ('owner', 'admin')
    )
  )
);