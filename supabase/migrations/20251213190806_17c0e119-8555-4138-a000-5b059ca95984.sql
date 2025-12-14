-- Add auto_add_new_contacts setting to kanban_boards
ALTER TABLE public.kanban_boards 
ADD COLUMN IF NOT EXISTS auto_add_new_contacts boolean NOT NULL DEFAULT true;