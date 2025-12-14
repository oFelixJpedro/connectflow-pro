-- Add deleted_by and deleted_by_name columns to messages table
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS deleted_by_name character varying(255);

-- Add comment for documentation
COMMENT ON COLUMN public.messages.deleted_by IS 'ID of the user who deleted the message (only for agent deletions)';
COMMENT ON COLUMN public.messages.deleted_by_name IS 'Name of the user who deleted the message for display purposes';