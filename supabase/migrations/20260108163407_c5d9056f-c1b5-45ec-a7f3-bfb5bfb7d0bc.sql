-- Support multiple Kanban boards per connection

-- Remove unique constraint on whatsapp_connection_id (allows multiple boards per connection)
ALTER TABLE public.kanban_boards 
  DROP CONSTRAINT IF EXISTS kanban_boards_whatsapp_connection_id_key;

-- Add name column for board identification
ALTER TABLE public.kanban_boards 
  ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT 'CRM Principal';

-- Add is_default flag to identify the primary board for new leads
ALTER TABLE public.kanban_boards 
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false;

-- Mark all existing boards as default (migration of existing data)
UPDATE public.kanban_boards SET is_default = true WHERE is_default = false;

-- Create unique partial index to ensure only 1 default board per connection
CREATE UNIQUE INDEX IF NOT EXISTS kanban_boards_default_per_connection 
  ON public.kanban_boards (whatsapp_connection_id) 
  WHERE is_default = true;