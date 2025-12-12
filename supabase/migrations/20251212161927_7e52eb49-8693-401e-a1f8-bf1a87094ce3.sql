-- Enable REPLICA IDENTITY FULL for contacts table (required for proper realtime updates)
ALTER TABLE public.contacts REPLICA IDENTITY FULL;