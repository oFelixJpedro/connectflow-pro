-- Add deleted message tracking fields to messages table
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS deleted_by_type VARCHAR(20);

-- Add comment for documentation
COMMENT ON COLUMN public.messages.is_deleted IS 'Indicates if the message was deleted on WhatsApp';
COMMENT ON COLUMN public.messages.deleted_at IS 'Timestamp when the message was deleted';
COMMENT ON COLUMN public.messages.deleted_by_type IS 'Who deleted the message: client or agent';