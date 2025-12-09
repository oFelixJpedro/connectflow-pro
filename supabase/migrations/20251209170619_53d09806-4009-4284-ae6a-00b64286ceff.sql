-- Add uazapi_base_url field to whatsapp_connections if not exists
ALTER TABLE public.whatsapp_connections 
ADD COLUMN IF NOT EXISTS uazapi_base_url text DEFAULT 'https://whatsapi.uazapi.com';

-- Update existing connections with default URL
UPDATE public.whatsapp_connections 
SET uazapi_base_url = 'https://whatsapi.uazapi.com' 
WHERE uazapi_base_url IS NULL;