-- Update all existing connections to use the new UAZAPI base URL
UPDATE whatsapp_connections 
SET uazapi_base_url = 'https://felix.uazapi.com'
WHERE uazapi_base_url = 'https://whatsapi.uazapi.com' OR uazapi_base_url IS NULL;

-- Set default value for new connections
ALTER TABLE whatsapp_connections 
ALTER COLUMN uazapi_base_url SET DEFAULT 'https://felix.uazapi.com';