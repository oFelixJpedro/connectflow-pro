-- Remover a policy RESTRICTIVE atual
DROP POLICY IF EXISTS "Users can view team members" ON public.profiles;

-- Criar nova policy PERMISSIVE que permite todos da mesma empresa verem todos os membros
CREATE POLICY "Users can view team members"
ON public.profiles
FOR SELECT
TO authenticated
USING (company_id = get_user_company_id());