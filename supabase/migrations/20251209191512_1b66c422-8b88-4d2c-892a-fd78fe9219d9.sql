-- Add quoted_message_id column to messages table for reply/quote functionality
ALTER TABLE messages 
ADD COLUMN quoted_message_id UUID REFERENCES messages(id);

-- Create index for efficient queries
CREATE INDEX idx_messages_quoted_message_id ON messages(quoted_message_id);

-- Add comment
COMMENT ON COLUMN messages.quoted_message_id IS 'Reference to the message being replied to (quote/reply)';