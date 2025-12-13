-- Create conversation_history table for detailed conversation timeline
CREATE TABLE public.conversation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  
  -- Event type
  event_type VARCHAR(50) NOT NULL,
  -- Possible values: created, assigned, transferred, department_changed, 
  -- status_changed, tag_added, tag_removed, connection_changed, 
  -- priority_changed, resolved, reopened, closed
  
  -- Event data (flexible JSONB)
  event_data JSONB NOT NULL DEFAULT '{}',
  
  -- Who performed the action
  performed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  performed_by_name VARCHAR(255),
  
  -- Automatic vs Manual
  is_automatic BOOLEAN DEFAULT false,
  
  -- Timestamp
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_conversation_history_conversation ON conversation_history(conversation_id);
CREATE INDEX idx_conversation_history_event_type ON conversation_history(event_type);
CREATE INDEX idx_conversation_history_created_at ON conversation_history(created_at);

-- Enable RLS
ALTER TABLE conversation_history ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view history for conversations in their company
CREATE POLICY "Users can view conversation history"
ON conversation_history
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = conversation_history.conversation_id
    AND c.company_id = get_user_company_id()
  )
);

-- RLS Policy: Users can create history entries for conversations in their company
CREATE POLICY "Users can create conversation history"
ON conversation_history
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = conversation_history.conversation_id
    AND c.company_id = get_user_company_id()
  )
);