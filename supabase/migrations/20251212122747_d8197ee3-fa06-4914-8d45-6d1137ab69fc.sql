-- Enable Realtime for profiles table to sync status across team members
ALTER TABLE public.profiles REPLICA IDENTITY FULL;

-- Add profiles to supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;