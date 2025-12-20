-- Drop the existing restrictive policy that only allows updating own messages
DROP POLICY IF EXISTS "Users can update their messages" ON public.messages;

-- Create new policy that allows users to update messages in their company conversations
-- This is needed so users can save transcriptions on inbound audio messages
CREATE POLICY "Users can update messages in their company conversations"
ON public.messages
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM conversations
    WHERE conversations.id = messages.conversation_id
    AND conversations.company_id = get_user_company_id()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM conversations
    WHERE conversations.id = messages.conversation_id
    AND conversations.company_id = get_user_company_id()
  )
);