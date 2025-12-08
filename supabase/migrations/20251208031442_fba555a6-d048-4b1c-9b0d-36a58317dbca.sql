-- Add needs_password_change column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS needs_password_change boolean NOT NULL DEFAULT false;

-- Comment for documentation
COMMENT ON COLUMN public.profiles.needs_password_change IS 'Forces user to change password on first login when true';