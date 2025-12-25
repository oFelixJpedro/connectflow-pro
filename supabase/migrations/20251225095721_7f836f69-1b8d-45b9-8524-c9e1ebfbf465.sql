-- Add is_support_session column to user_sessions table
-- This allows developer support sessions to coexist with user sessions

ALTER TABLE public.user_sessions 
ADD COLUMN is_support_session BOOLEAN NOT NULL DEFAULT false;

-- Add a comment to explain the column purpose
COMMENT ON COLUMN public.user_sessions.is_support_session IS 'Indicates if this session is a developer support session that should not invalidate other user sessions';