-- Add RLS policies to allow admins/owners to manage user roles

-- Policy: Admins and owners can view all roles in their company
CREATE POLICY "Admins can view all roles in company"
ON public.user_roles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = user_roles.user_id
    AND p.company_id = get_user_company_id()
  )
  AND is_admin_or_owner()
);

-- Policy: Admins and owners can insert roles for users in their company
CREATE POLICY "Admins can insert roles in company"
ON public.user_roles
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = user_roles.user_id
    AND p.company_id = get_user_company_id()
  )
  AND is_admin_or_owner()
);

-- Policy: Admins and owners can update roles for users in their company
-- (except owner role which only owner can manage)
CREATE POLICY "Admins can update roles in company"
ON public.user_roles
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = user_roles.user_id
    AND p.company_id = get_user_company_id()
  )
  AND is_admin_or_owner()
  -- Admins cannot update owner's role
  AND (
    get_user_role() = 'owner'
    OR user_roles.role != 'owner'
  )
);

-- Policy: Admins and owners can delete roles for users in their company
CREATE POLICY "Admins can delete roles in company"
ON public.user_roles
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = user_roles.user_id
    AND p.company_id = get_user_company_id()
  )
  AND is_admin_or_owner()
  -- Admins cannot delete owner's role
  AND (
    get_user_role() = 'owner'
    OR user_roles.role != 'owner'
  )
);