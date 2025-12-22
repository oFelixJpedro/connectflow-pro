-- Add new values to company_plan enum
ALTER TYPE public.company_plan ADD VALUE IF NOT EXISTS 'monthly';
ALTER TYPE public.company_plan ADD VALUE IF NOT EXISTS 'semiannual';
ALTER TYPE public.company_plan ADD VALUE IF NOT EXISTS 'annual';
ALTER TYPE public.company_plan ADD VALUE IF NOT EXISTS 'lifetime';
ALTER TYPE public.company_plan ADD VALUE IF NOT EXISTS 'trial';

-- Add new columns to companies table for subscription limits
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS max_connections INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS max_users INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS max_ai_agents INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS commercial_manager_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS subscription_status VARCHAR DEFAULT 'trial';

-- Add comment for documentation
COMMENT ON COLUMN public.companies.max_connections IS 'Maximum number of WhatsApp connections allowed. NULL means unlimited.';
COMMENT ON COLUMN public.companies.max_users IS 'Maximum number of users allowed. NULL means unlimited.';
COMMENT ON COLUMN public.companies.max_ai_agents IS 'Maximum number of AI agents allowed. NULL means unlimited.';
COMMENT ON COLUMN public.companies.commercial_manager_enabled IS 'Whether the Commercial Manager feature is enabled for this company.';
COMMENT ON COLUMN public.companies.subscription_status IS 'Current subscription status: trial, active, cancelled, expired';