-- Add instance_token column to whatsapp_connections
ALTER TABLE whatsapp_connections
ADD COLUMN IF NOT EXISTS instance_token TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_whatsapp_connections_instance_token 
ON whatsapp_connections(instance_token);