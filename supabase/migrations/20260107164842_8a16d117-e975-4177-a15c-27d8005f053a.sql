-- Block agent activation without credits via RLS WITH CHECK
-- This ensures no agent can be set to status='active' without appropriate credits

-- First, drop the existing update policy
DROP POLICY IF EXISTS "Admins can update agents" ON public.ai_agents;

-- Recreate with WITH CHECK that validates credits before activation
CREATE POLICY "Admins can update agents" ON public.ai_agents
FOR UPDATE
TO authenticated
USING (
  company_id = get_user_company_id() 
  AND is_admin_or_owner()
)
WITH CHECK (
  company_id = get_user_company_id() 
  AND is_admin_or_owner()
  AND (
    -- Allow any update if NOT activating
    status IS DISTINCT FROM 'active'
    OR
    -- If activating, require credits for the selected model type
    EXISTS (
      SELECT 1
      FROM public.ai_credits c
      WHERE c.company_id = ai_agents.company_id
        AND (
          -- Standard model requires standard_text_tokens > 0
          (COALESCE(ai_agents.ai_model_type, 'standard') = 'standard' AND COALESCE(c.standard_text_tokens, 0) > 0)
          OR
          -- Advanced model requires advanced_text_tokens > 0
          (ai_agents.ai_model_type = 'advanced' AND COALESCE(c.advanced_text_tokens, 0) > 0)
        )
    )
  )
);