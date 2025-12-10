-- Add unique constraint for upsert operations on message_reactions
-- This ensures one reaction per user per message

-- First check if the constraint already exists and drop if needed
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'message_reactions_unique_user_message'
    ) THEN
        ALTER TABLE public.message_reactions DROP CONSTRAINT message_reactions_unique_user_message;
    END IF;
END $$;

-- Add the unique constraint
ALTER TABLE public.message_reactions 
ADD CONSTRAINT message_reactions_unique_user_message 
UNIQUE (message_id, reactor_id, reactor_type);