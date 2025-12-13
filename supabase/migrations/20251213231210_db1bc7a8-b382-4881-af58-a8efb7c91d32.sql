-- Add column to track group messages preference
ALTER TABLE public.whatsapp_connections 
ADD COLUMN receive_group_messages BOOLEAN DEFAULT false;