-- Add signature fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS signature TEXT,
ADD COLUMN IF NOT EXISTS signature_enabled BOOLEAN DEFAULT false;