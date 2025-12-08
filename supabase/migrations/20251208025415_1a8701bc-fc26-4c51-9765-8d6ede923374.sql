-- Add access_level column to connection_users table
ALTER TABLE public.connection_users 
ADD COLUMN access_level text NOT NULL DEFAULT 'full';

-- Add comment explaining the column
COMMENT ON COLUMN public.connection_users.access_level IS 'Access level: full (sees all conversations) or assigned_only (sees only assigned conversations)';