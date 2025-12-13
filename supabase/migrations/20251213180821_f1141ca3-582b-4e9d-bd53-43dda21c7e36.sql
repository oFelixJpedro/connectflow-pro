-- Add visibility fields to quick_reply_categories table
ALTER TABLE public.quick_reply_categories 
ADD COLUMN IF NOT EXISTS visibility_type public.quick_reply_visibility NOT NULL DEFAULT 'all',
ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS whatsapp_connection_id uuid REFERENCES public.whatsapp_connections(id) ON DELETE SET NULL;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_quick_reply_categories_visibility ON public.quick_reply_categories(visibility_type);
CREATE INDEX IF NOT EXISTS idx_quick_reply_categories_department ON public.quick_reply_categories(department_id);
CREATE INDEX IF NOT EXISTS idx_quick_reply_categories_connection ON public.quick_reply_categories(whatsapp_connection_id);