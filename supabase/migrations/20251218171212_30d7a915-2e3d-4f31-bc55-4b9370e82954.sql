-- Enable real-time for ai_conversation_states
ALTER TABLE ai_conversation_states REPLICA IDENTITY FULL;

-- Add table to realtime publication (only if not already added)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'ai_conversation_states'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE ai_conversation_states;
  END IF;
END $$;