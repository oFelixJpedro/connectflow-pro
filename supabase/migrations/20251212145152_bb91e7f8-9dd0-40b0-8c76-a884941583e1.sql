-- Remove status column from profiles table
ALTER TABLE public.profiles DROP COLUMN IF EXISTS status;

-- Drop the user_status enum type (if not used elsewhere)
DROP TYPE IF EXISTS public.user_status;