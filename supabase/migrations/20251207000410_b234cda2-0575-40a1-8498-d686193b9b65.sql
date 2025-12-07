-- Add whatsapp_message_id column to messages table
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS whatsapp_message_id TEXT;

-- Create index for performance on whatsapp_message_id
CREATE INDEX IF NOT EXISTS idx_messages_whatsapp_message_id 
ON messages(whatsapp_message_id);