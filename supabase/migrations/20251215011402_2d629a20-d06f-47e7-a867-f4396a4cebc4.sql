-- Drop the existing check constraint
ALTER TABLE public.internal_chat_rooms 
DROP CONSTRAINT IF EXISTS internal_chat_rooms_type_check;

-- Add new constraint including 'group'
ALTER TABLE public.internal_chat_rooms 
ADD CONSTRAINT internal_chat_rooms_type_check 
CHECK (type::text IN ('general', 'direct', 'group'));