-- Enable Realtime for contacts table
ALTER TABLE public.contacts REPLICA IDENTITY FULL;

-- Add contacts to supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.contacts;