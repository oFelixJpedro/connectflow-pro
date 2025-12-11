-- Add crm_access column to connection_users table
-- This controls whether the user can access CRM for that specific connection
ALTER TABLE public.connection_users 
ADD COLUMN IF NOT EXISTS crm_access boolean NOT NULL DEFAULT false;

-- Update existing records to have crm_access = false by default
-- (admin needs to explicitly enable CRM access per connection)

-- Comment for documentation
COMMENT ON COLUMN public.connection_users.crm_access IS 'Whether the user has access to the CRM/Kanban board for this connection';